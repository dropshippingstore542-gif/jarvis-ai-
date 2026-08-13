import Anthropic from "@anthropic-ai/sdk";
import type {
  ChatMessage,
  ChatParams,
  ChatStreamEvent,
  LLMProvider,
  StopReason,
  ToolCallRequest,
} from "./types.js";
import { LLMConfigError } from "./types.js";

type AnthropicMessage = Anthropic.MessageParam;
type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; tool_use_id: string; content: string };

function toAnthropicMessages(messages: ChatMessage[]): AnthropicMessage[] {
  const out: AnthropicMessage[] = [];

  for (const msg of messages) {
    if (msg.role === "system") continue; // handled separately

    if (msg.role === "tool") {
      const block: AnthropicContentBlock = {
        type: "tool_result",
        tool_use_id: msg.toolCallId ?? "",
        content: msg.content,
      };
      const last = out[out.length - 1];
      if (last && last.role === "user" && Array.isArray(last.content)) {
        (last.content as AnthropicContentBlock[]).push(block);
      } else {
        out.push({ role: "user", content: [block] as never });
      }
      continue;
    }

    if (msg.role === "assistant" && msg.toolCalls?.length) {
      const blocks: AnthropicContentBlock[] = [];
      if (msg.content) blocks.push({ type: "text", text: msg.content });
      for (const call of msg.toolCalls) {
        blocks.push({ type: "tool_use", id: call.id, name: call.name, input: call.input });
      }
      out.push({ role: "assistant", content: blocks as never });
      continue;
    }

    out.push({ role: msg.role === "assistant" ? "assistant" : "user", content: msg.content });
  }

  return out;
}

function mapStopReason(reason: string | null): StopReason {
  switch (reason) {
    case "tool_use":
      return "tool_use";
    case "max_tokens":
      return "max_tokens";
    case "end_turn":
    case "stop_sequence":
      return "end_turn";
    default:
      return "end_turn";
  }
}

export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic";
  private client: Anthropic;

  constructor(opts: { apiKey?: string; baseURL?: string }) {
    if (!opts.apiKey) {
      throw new LLMConfigError(
        "AI_PROVIDER=anthropic requires AI_API_KEY to be set (see .env.example).",
      );
    }
    this.client = new Anthropic({ apiKey: opts.apiKey, baseURL: opts.baseURL });
  }

  async *chat(params: ChatParams): AsyncGenerator<ChatStreamEvent> {
    try {
      const stream = this.client.messages.stream({
        model: params.model,
        system: params.system,
        max_tokens: params.maxTokens ?? 4096,
        temperature: params.temperature,
        tools: params.tools?.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
        })),
        messages: toAnthropicMessages(params.messages),
      });

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          yield { type: "text_delta", text: event.delta.text };
        }
      }

      const final = await stream.finalMessage();
      for (const block of final.content) {
        if (block.type === "tool_use") {
          const call: ToolCallRequest = { id: block.id, name: block.name, input: block.input };
          yield { type: "tool_call", call };
        }
      }

      yield {
        type: "message_stop",
        stopReason: mapStopReason(final.stop_reason),
        usage: {
          inputTokens: final.usage.input_tokens,
          outputTokens: final.usage.output_tokens,
        },
      };
    } catch (err) {
      yield { type: "error", message: err instanceof Error ? err.message : String(err) };
    }
  }
}
