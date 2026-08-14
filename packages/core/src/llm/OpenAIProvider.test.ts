import { describe, expect, it } from "vitest";
import { toOpenAIMessages } from "./OpenAIProvider.js";
import type { ChatMessage } from "./types.js";

describe("toOpenAIMessages (image handling)", () => {
  it("keeps the tool message text-only and injects a synthetic user message carrying the image", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "take a screenshot" },
      {
        role: "assistant",
        content: "",
        toolCalls: [{ id: "call_1", name: "browser.screenshot", input: {} }],
      },
      {
        role: "tool",
        content: '{"width":800,"height":600}',
        toolCallId: "call_1",
        toolName: "browser.screenshot",
        images: [{ mimeType: "image/png", base64: "AAAA" }],
      },
    ];

    const out = toOpenAIMessages(undefined, messages);
    const toolMsg = out.find((m) => m.role === "tool") as { content: unknown };
    expect(typeof toolMsg.content).toBe("string");
    expect(toolMsg.content).toContain("image attached");

    const last = out[out.length - 1] as { role: string; content: { type: string }[] };
    expect(last.role).toBe("user");
    expect(Array.isArray(last.content)).toBe(true);
    expect(last.content.some((p) => p.type === "image_url")).toBe(true);
  });

  it("attaches an image directly on a plain user message", () => {
    const messages: ChatMessage[] = [
      {
        role: "user",
        content: "what's in this picture?",
        images: [{ mimeType: "image/jpeg", base64: "BBBB" }],
      },
    ];
    const out = toOpenAIMessages(undefined, messages);
    const msg = out[0] as { content: { type: string }[] };
    expect(msg.content.some((p) => p.type === "text")).toBe(true);
    expect(msg.content.some((p) => p.type === "image_url")).toBe(true);
  });

  it("does not inject an extra message when a tool result has no image", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "hi" },
      { role: "assistant", content: "", toolCalls: [{ id: "c1", name: "memory.recall", input: {} }] },
      { role: "tool", content: '{"memories":[]}', toolCallId: "c1", toolName: "memory.recall" },
    ];
    const out = toOpenAIMessages(undefined, messages);
    expect(out).toHaveLength(3);
    expect(out[2]).toMatchObject({ role: "tool", content: '{"memories":[]}' });
  });
});
