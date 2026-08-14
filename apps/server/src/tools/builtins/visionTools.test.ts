import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createVisionTools, UnsupportedImageTypeError } from "./visionTools.js";
import { PathTraversalError } from "./filesystemTools.js";
import type { ToolContext } from "@jarvis/core";

// A minimal valid 1x1 PNG (real bytes, not a fixture description).
const ONE_PIXEL_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

describe("vision.describe_image", () => {
  let workspaceDir: string;
  let ctx: ToolContext;

  beforeEach(async () => {
    workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "jarvis-vision-test-"));
    ctx = {
      conversationId: "c1",
      userId: "u1",
      workspaceDir,
      logger: {
        debug() {},
        info() {},
        warn() {},
        error() {},
        child() {
          return ctx.logger;
        },
      },
    };
  });

  afterEach(async () => {
    await fs.rm(workspaceDir, { recursive: true, force: true });
  });

  it("reads a real image file and returns its exact bytes as base64", async () => {
    await fs.writeFile(path.join(workspaceDir, "pixel.png"), Buffer.from(ONE_PIXEL_PNG_BASE64, "base64"));
    const { describeImage } = createVisionTools();
    const result = await describeImage.execute({ path: "pixel.png" }, ctx);
    expect(result.image.mimeType).toBe("image/png");
    expect(result.image.base64).toBe(ONE_PIXEL_PNG_BASE64);
  });

  it("rejects unsupported file extensions", async () => {
    const { describeImage } = createVisionTools();
    await expect(describeImage.execute({ path: "notes.txt" }, ctx)).rejects.toThrow(UnsupportedImageTypeError);
  });

  it("stays inside the sandboxed workspace", async () => {
    const { describeImage } = createVisionTools();
    await expect(describeImage.execute({ path: "../outside.png" }, ctx)).rejects.toThrow(PathTraversalError);
  });

  it("reports a clear error for a missing file", async () => {
    const { describeImage } = createVisionTools();
    await expect(describeImage.execute({ path: "missing.png" }, ctx)).rejects.toThrow();
  });
});
