import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import type { Tool } from "@jarvis/core";
import { resolveSafePath } from "./filesystemTools.js";

const MIME_BY_EXTENSION: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

export class UnsupportedImageTypeError extends Error {
  constructor(ext: string) {
    super(
      `Unsupported image type "${ext}". Supported: ${Object.keys(MIME_BY_EXTENSION).join(", ")}.`,
    );
    this.name = "UnsupportedImageTypeError";
  }
}

type DescribeImageResult = {
  path: string;
  image: { mimeType: string; base64: string };
};

export function createVisionTools(): { describeImage: Tool<{ path: string }, DescribeImageResult> } {
  const describeImage: Tool<{ path: string }, DescribeImageResult> = {
    name: "vision.describe_image",
    description:
      "Load an image file from the sandboxed workspace directory and see it — use this when the user " +
      "asks you to look at, describe, or analyze an image/screenshot/photo/document they've placed in " +
      "the workspace.",
    inputSchema: z.object({ path: z.string() }),
    outputSchema: z.object({
      path: z.string(),
      image: z.object({ mimeType: z.string(), base64: z.string() }),
    }),
    permission: "safe",
    async execute(input, ctx) {
      const ext = path.extname(input.path).toLowerCase();
      const mimeType = MIME_BY_EXTENSION[ext];
      if (!mimeType) throw new UnsupportedImageTypeError(ext || "(none)");

      const target = resolveSafePath(ctx.workspaceDir, input.path);
      const bytes = await fs.readFile(target);
      return {
        path: input.path,
        image: { mimeType, base64: bytes.toString("base64") },
      };
    },
  };

  return { describeImage };
}
