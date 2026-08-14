import { describe, expect, it } from "vitest";
import { toAnthropicMessages } from "./AnthropicProvider.js";
import type { ChatMessage } from "./types.js";

describe("toAnthropicMessages (image handling)", () => {
  it("attaches an image inside a tool_result content array", () => {
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

    const out = toAnthropicMessages(messages);
    const toolResultMsg = out[out.length - 1] as { role: string; content: unknown[] };
    expect(toolResultMsg.role).toBe("user");
    const toolResultBlock = toolResultMsg.content[0] as { type: string; content: unknown[] };
    expect(toolResultBlock.type).toBe("tool_result");
    expect(Array.isArray(toolResultBlock.content)).toBe(true);
    const blocks = toolResultBlock.content as { type: string }[];
    expect(blocks.some((b) => b.type === "text")).toBe(true);
    expect(blocks.some((b) => b.type === "image")).toBe(true);
  });

  it("attaches an image on a plain user message", () => {
    const messages: ChatMessage[] = [
      {
        role: "user",
        content: "what's in this picture?",
        images: [{ mimeType: "image/jpeg", base64: "BBBB" }],
      },
    ];
    const out = toAnthropicMessages(messages);
    const msg = out[0] as { content: { type: string }[] };
    expect(msg.content.some((b) => b.type === "text")).toBe(true);
    expect(msg.content.some((b) => b.type === "image")).toBe(true);
  });

  it("keeps a plain-text tool result as a string when there's no image", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "hi" },
      { role: "assistant", content: "", toolCalls: [{ id: "c1", name: "memory.recall", input: {} }] },
      { role: "tool", content: '{"memories":[]}', toolCallId: "c1", toolName: "memory.recall" },
    ];
    const out = toAnthropicMessages(messages);
    const toolResultMsg = out[out.length - 1] as { content: { content: unknown }[] };
    expect(toolResultMsg.content[0]?.content).toBe('{"memories":[]}');
  });
});
