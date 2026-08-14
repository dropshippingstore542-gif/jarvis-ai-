import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import type { Tool } from "@jarvis/core";

export class PathTraversalError extends Error {
  constructor(relativePath: string) {
    super(`Refusing to access "${relativePath}": outside the sandboxed workspace directory.`);
    this.name = "PathTraversalError";
  }
}

/** Every filesystem.* tool is hard-jailed to ctx.workspaceDir — no exceptions. */
export function resolveSafePath(workspaceDir: string, relativePath: string): string {
  const resolved = path.resolve(workspaceDir, relativePath);
  const relative = path.relative(workspaceDir, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new PathTraversalError(relativePath);
  }
  return resolved;
}

export interface FilesystemTools {
  read: Tool<{ path: string }, { content: string }>;
  write: Tool<{ path: string; content: string }, { bytesWritten: number }>;
  list: Tool<{ path?: string }, { entries: { name: string; type: "file" | "directory" }[] }>;
  mkdir: Tool<{ path: string }, { created: string }>;
  move: Tool<{ from: string; to: string }, { moved: boolean }>;
  delete: Tool<{ path: string; recursive?: boolean }, { deleted: boolean }>;
}

export function createFilesystemTools(): FilesystemTools {
  const read: Tool<{ path: string }, { content: string }> = {
    name: "filesystem.read",
    description: "Read a text file's contents from the sandboxed workspace directory.",
    inputSchema: z.object({ path: z.string() }),
    outputSchema: z.object({ content: z.string() }),
    permission: "safe",
    async execute(input, ctx) {
      const target = resolveSafePath(ctx.workspaceDir, input.path);
      const content = await fs.readFile(target, "utf-8");
      return { content };
    },
  };

  const write: Tool<{ path: string; content: string }, { bytesWritten: number }> = {
    name: "filesystem.write",
    description: "Create or overwrite a text file in the sandboxed workspace directory. Never touches the user's original files elsewhere on disk.",
    inputSchema: z.object({ path: z.string(), content: z.string() }),
    outputSchema: z.object({ bytesWritten: z.number() }),
    permission: "low",
    async execute(input, ctx) {
      const target = resolveSafePath(ctx.workspaceDir, input.path);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, input.content, "utf-8");
      return { bytesWritten: Buffer.byteLength(input.content, "utf-8") };
    },
    async verify(input, output, ctx) {
      const target = resolveSafePath(ctx.workspaceDir, input.path);
      try {
        const onDisk = await fs.readFile(target, "utf-8");
        return { ok: onDisk === input.content, note: onDisk === input.content ? undefined : "on-disk content does not match what was written" };
      } catch (err) {
        return { ok: false, note: err instanceof Error ? err.message : String(err) };
      }
    },
  };

  const list: Tool<{ path?: string }, { entries: { name: string; type: "file" | "directory" }[] }> = {
    name: "filesystem.list",
    description: "List files and directories at a path within the sandboxed workspace directory.",
    inputSchema: z.object({ path: z.string().optional() }),
    outputSchema: z.object({
      entries: z.array(z.object({ name: z.string(), type: z.enum(["file", "directory"]) })),
    }),
    permission: "safe",
    async execute(input, ctx) {
      const target = resolveSafePath(ctx.workspaceDir, input.path ?? ".");
      const dirents = await fs.readdir(target, { withFileTypes: true });
      return {
        entries: dirents.map((d) => ({
          name: d.name,
          type: d.isDirectory() ? ("directory" as const) : ("file" as const),
        })),
      };
    },
  };

  const mkdir: Tool<{ path: string }, { created: string }> = {
    name: "filesystem.mkdir",
    description: "Create a directory (and any missing parent directories) in the sandboxed workspace.",
    inputSchema: z.object({ path: z.string().min(1) }),
    outputSchema: z.object({ created: z.string() }),
    permission: "low",
    async execute(input, ctx) {
      const target = resolveSafePath(ctx.workspaceDir, input.path);
      await fs.mkdir(target, { recursive: true });
      return { created: input.path };
    },
  };

  const move: Tool<{ from: string; to: string }, { moved: boolean }> = {
    name: "filesystem.move",
    description:
      "Move or rename a file or directory within the sandboxed workspace. Refuses to overwrite an " +
      "existing file at the destination.",
    inputSchema: z.object({ from: z.string().min(1), to: z.string().min(1) }),
    outputSchema: z.object({ moved: z.boolean() }),
    permission: "low",
    async execute(input, ctx) {
      const from = resolveSafePath(ctx.workspaceDir, input.from);
      const to = resolveSafePath(ctx.workspaceDir, input.to);

      const destinationExists = await fs
        .access(to)
        .then(() => true)
        .catch(() => false);
      if (destinationExists) {
        throw new Error(`Refusing to move: "${input.to}" already exists.`);
      }

      await fs.mkdir(path.dirname(to), { recursive: true });
      await fs.rename(from, to);
      return { moved: true };
    },
  };

  const del: Tool<{ path: string; recursive?: boolean }, { deleted: boolean }> = {
    name: "filesystem.delete",
    description:
      "Permanently delete a file or directory from the sandboxed workspace. Irreversible — the " +
      "highest-risk filesystem operation, requires explicit approval.",
    inputSchema: z.object({ path: z.string().min(1), recursive: z.boolean().optional() }),
    outputSchema: z.object({ deleted: z.boolean() }),
    permission: "high",
    async execute(input, ctx) {
      const target = resolveSafePath(ctx.workspaceDir, input.path);
      await fs.rm(target, { recursive: input.recursive ?? false, force: false });
      return { deleted: true };
    },
  };

  return { read, write, list, mkdir, move, delete: del };
}
