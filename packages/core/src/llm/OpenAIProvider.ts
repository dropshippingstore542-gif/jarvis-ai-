import OpenAI from "openai";
import type {
  ChatMessage,
  ChatParams,
  ChatStreamEvent,
  LLMProvider,
  StopReason,
} from "./types.js";
import { LLMConfigError } from "./types.js";

function imageContentParts(
  images: ChatMessage["images"],
): OpenAI.Chat.ChatCompletionContentPartImage[] {
  return (images ?? []).map((img) => ({
    type: "image_url",
    image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
  }));
}

export function toOpenAIMessages(
  system: string | undefined,
  messages: ChatMessage[],
): OpenAI.Chat.ChatCompletionMessageParam[] {
  const out: OpenAI.Chat.ChatCompletionMessageParam[] = [];
  if (system) out.push({ role: "system", content: system });

  for (const msg of messages) {
    if (msg.role === "system") continue;
    if (msg.role === "tool") {
      // The OpenAI tool-result message schema is text-only — it cannot carry
      // image content. So the model still genuinely sees the image, attach it
      // as a synthetic user turn right after the (text) tool result, rather
      // than silently dropping it.
      out.push({
        role: "tool",
        tool_call_id: msg.toolCallId ?? "",
        content: msg.images?.length
          ? `${msg.content} (image attached in the next message)`
          : msg.content,
      });
      if (msg.images?.length) {
        out.push({
          role: "user",
          content: [
            { type: "text", text: `Image result from ${msg.toolName ?? "the last tool call"}:` },
            ...imageContentParts(msg.images),
          ],
        });
      }
      continue;
    }
    if (msg.role === "assistant" && msg.toolCalls?.length) {
      out.push({
        role: "assistant",
        content: msg.content || null,
        tool_calls: msg.toolCalls.map((call) => ({
          id: call.id,
          type: "function",
          function: { name: call.name, arguments: JSON.stringify(call.input) },
        })),
      });
      continue;
    }
    if (msg.images?.length) {
      out.push({
        role: msg.role === "assistant" ? "assistant" : "user",
        content: [{ type: "text", text: msg.content }, ...imageContentParts(msg.images)],
      } as OpenAI.Chat.ChatCompletionUserMessageParam);
      continue;
    }
    out.push({ role: msg.role, content: msg.content });
  }

  return out;
}

function mapFinishReason(reason: string | null | undefined): StopReason {
  switch (reason) {
    case "tool_calls":
      return "tool_use";
    case "length":
      return "max_tokens";
    default:
      return "end_turn";
  }
}

/**
 * Shared implementation for the official OpenAI API and any OpenAI-compatible
 * endpoint (used by LocalProvider for Ollama/LM Studio/etc.).
 */
export class OpenAIProvider implements LLMProvider {
  readonly name: string;
  protected client: OpenAI;

  constructor(opts: { apiKey?: string; baseURL?: string; providerName?: string }) {
    if (!opts.apiKey && !opts.baseURL) {
      throw new LLMConfigError(
        "AI_PROVIDER=openai requires AI_API_KEY to be set (see .env.example).",
      );
    }
    this.name = opts.providerName ?? "openai";
    this.client = new OpenAI({ apiKey: opts.apiKey ?? "unused", baseURL: opts.baseURL });
  }

  async *chat(params: ChatParams): AsyncGenerator<ChatStreamEvent> {
    try {
      const stream = await this.client.chat.completions.create({
        model: params.model,
        messages: toOpenAIMessages(params.system, params.messages),
        tools: params.tools?.map((t) => ({
          type: "function",
          function: { name: t.name, description: t.description, parameters: t.inputSchema },
        })),
        max_tokens: params.maxTokens,
        temperature: params.temperature,
        stream: true,
      });

      const toolCallBuffers = new Map<number, { id: string; name: string; args: string }>();
      let finishReason: string | null | undefined = null;

      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        if (!choice) continue;
        if (choice.delta?.content) {
          yield { type: "text_delta", text: choice.delta.content };
        }
        if (choice.delta?.tool_calls) {
          for (const tc of choice.delta.tool_calls) {
            const idx = tc.index;
            const existing = toolCallBuffers.get(idx) ?? { id: "", name: "", args: "" };
            if (tc.id) existing.id = tc.id;
            if (tc.function?.name) existing.name += tc.function.name;
            if (tc.function?.arguments) existing.args += tc.function.arguments;
            toolCallBuffers.set(idx, existing);
          }
        }
        if (choice.finish_reason) finishReason = choice.finish_reason;
      }

      for (const buf of toolCallBuffers.values()) {
        let input: unknown = {};
        try {
          input = buf.args ? JSON.parse(buf.args) : {};
        } catch {
          input = { _rawArguments: buf.args };
        }
        yield { type: "tool_call", call: { id: buf.id, name: buf.name, input } };
      }

      yield { type: "message_stop", stopReason: mapFinishReason(finishReason) };
    } catch (err) {
      yield { type: "error", message: err instanceof Error ? err.message : String(err) };
    }
  }
}
