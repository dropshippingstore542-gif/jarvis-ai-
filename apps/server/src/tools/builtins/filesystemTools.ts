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

  return { read, write, list };
}
