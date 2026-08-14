import type { ImageAttachment } from "../llm/types.js";

/**
 * Convention every vision-producing tool follows: return real image bytes
 * under an `image` field shaped like this. The orchestrator looks for it on
 * any tool's output and attaches it to the conversation as a genuine
 * multi-modal message (see brain/orchestrator.ts) — no separate "vision
 * tool registry" needed, any tool can produce one.
 */
export interface ToolImageOutput {
  image?: ImageAttachment;
}

export function extractImageAttachment(output: unknown): ImageAttachment | undefined {
  if (!output || typeof output !== "object" || !("image" in output)) return undefined;
  const img = (output as { image?: unknown }).image;
  if (
    img &&
    typeof img === "object" &&
    typeof (img as ImageAttachment).mimeType === "string" &&
    typeof (img as ImageAttachment).base64 === "string"
  ) {
    return img as ImageAttachment;
  }
  return undefined;
}
