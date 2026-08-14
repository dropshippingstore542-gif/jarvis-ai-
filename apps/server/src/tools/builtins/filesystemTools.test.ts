import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createFilesystemTools, resolveSafePath, PathTraversalError } from "./filesystemTools.js";
import type { ToolContext } from "@jarvis/core";

describe("resolveSafePath", () => {
  const workspace = "/workspace";

  it("resolves a plain relative path inside the workspace", () => {
    expect(resolveSafePath(workspace, "notes.txt")).toBe(path.resolve(workspace, "notes.txt"));
    expect(resolveSafePath(workspace, "sub/dir/file.txt")).toBe(
      path.resolve(workspace, "sub/dir/file.txt"),
    );
  });

  it("rejects parent-directory traversal", () => {
    expect(() => resolveSafePath(workspace, "../secrets.txt")).toThrow(PathTraversalError);
    expect(() => resolveSafePath(workspace, "../../etc/passwd")).toThrow(PathTraversalError);
    expect(() => resolveSafePath(workspace, "sub/../../escape.txt")).toThrow(PathTraversalError);
  });

  it("rejects absolute paths outside the workspace", () => {
    expect(() => resolveSafePath(workspace, "/etc/passwd")).toThrow(PathTraversalError);
  });
});

describe("filesystem tools execute within the sandbox", () => {
  let workspaceDir: string;
  let ctx: ToolContext;

  beforeEach(async () => {
    workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "jarvis-fs-test-"));
    ctx = {
      conversationId: "c1",
      userId: "u1",
      workspaceDir,
      logger: { debug() {}, info() {}, warn() {}, error() {}, child() {
        return ctx.logger;
      } },
    };
  });

  afterEach(async () => {
    await fs.rm(workspaceDir, { recursive: true, force: true });
  });

  it("writes then reads a file back", async () => {
    const { read, write } = createFilesystemTools();
    await write.execute({ path: "hello.txt", content: "hi there" }, ctx);
    const result = await read.execute({ path: "hello.txt" }, ctx);
    expect(result.content).toBe("hi there");
  });

  it("refuses to write outside the workspace even via execute()", async () => {
    const { write } = createFilesystemTools();
    await expect(write.execute({ path: "../outside.txt", content: "x" }, ctx)).rejects.toThrow(
      PathTraversalError,
    );
  });

  it("lists directory entries", async () => {
    const { write, list } = createFilesystemTools();
    await write.execute({ path: "a.txt", content: "1" }, ctx);
    await write.execute({ path: "dir/b.txt", content: "2" }, ctx);
    const result = await list.execute({}, ctx);
    const names = result.entries.map((e) => e.name).sort();
    expect(names).toEqual(["a.txt", "dir"]);
  });

  it("creates nested directories with mkdir", async () => {
    const { mkdir, list } = createFilesystemTools();
    await mkdir.execute({ path: "a/b/c" }, ctx);
    const result = await list.execute({ path: "a/b" }, ctx);
    expect(result.entries).toEqual([{ name: "c", type: "directory" }]);
  });

  it("moves a file and refuses to overwrite an existing destination", async () => {
    const { write, move, read } = createFilesystemTools();
    await write.execute({ path: "a.txt", content: "hello" }, ctx);
    await move.execute({ from: "a.txt", to: "b/a.txt" }, ctx);
    expect((await read.execute({ path: "b/a.txt" }, ctx)).content).toBe("hello");
    await expect(read.execute({ path: "a.txt" }, ctx)).rejects.toThrow();

    await write.execute({ path: "c.txt", content: "other" }, ctx);
    await expect(move.execute({ from: "c.txt", to: "b/a.txt" }, ctx)).rejects.toThrow(/already exists/);
  });

  it("deletes a file, and refuses non-empty directories without recursive:true", async () => {
    const { write, delete: del, list } = createFilesystemTools();
    await write.execute({ path: "gone.txt", content: "x" }, ctx);
    await del.execute({ path: "gone.txt" }, ctx);
    await expect(list.execute({}, ctx).then((r) => r.entries.some((e) => e.name === "gone.txt"))).resolves.toBe(
      false,
    );

    await write.execute({ path: "dir/inner.txt", content: "x" }, ctx);
    await expect(del.execute({ path: "dir" }, ctx)).rejects.toThrow();
    await del.execute({ path: "dir", recursive: true }, ctx);
  });

  it("refuses filesystem.move/delete outside the workspace", async () => {
    const { move, delete: del } = createFilesystemTools();
    await expect(move.execute({ from: "../x.txt", to: "y.txt" }, ctx)).rejects.toThrow(PathTraversalError);
    await expect(del.execute({ path: "../x.txt" }, ctx)).rejects.toThrow(PathTraversalError);
  });
});
