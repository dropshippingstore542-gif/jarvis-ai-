export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ToolCallRequest {
  id: string;
  name: string;
  input: unknown;
}

/** Real image bytes (e.g. a browser screenshot or an uploaded file) attached to a message. */
export interface ImageAttachment {
  mimeType: string;
  base64: string;
}

export interface ChatMessage {
  role: ChatRole;
  /** Plain text content. Empty string is valid (e.g. a tool-call-only assistant turn). */
  content: string;
  /**
   * Images attached to this turn — a vision-capable model genuinely sees these
   * (not a text description of them). Providers place them per their own API's
   * rules; see AnthropicProvider/OpenAIProvider for how each handles an image
   * attached to a role:"tool" message, since not every provider allows images
   * inside a tool result.
   */
  images?: ImageAttachment[];
  /** Present on assistant messages that requested tool calls. */
  toolCalls?: ToolCallRequest[];
  /** Present on role:"tool" messages — which call this result answers. */
  toolCallId?: string;
  toolName?: string;
}

export interface ToolSpec {
  name: string;
  description: string;
  /** JSON Schema (draft-07-ish, as accepted by Anthropic/OpenAI tool-use APIs). */
  inputSchema: Record<string, unknown>;
}

export interface ChatParams {
  model: string;
  system?: string;
  messages: ChatMessage[];
  tools?: ToolSpec[];
  maxTokens?: number;
  temperature?: number;
}

export type StopReason = "end_turn" | "tool_use" | "max_tokens" | "error";

export type ChatStreamEvent =
  | { type: "text_delta"; text: string }
  | { type: "tool_call"; call: ToolCallRequest }
  | {
      type: "message_stop";
      stopReason: StopReason;
      usage?: { inputTokens: number; outputTokens: number };
    }
  | { type: "error"; message: string };

export interface LLMProvider {
  readonly name: string;
  chat(params: ChatParams): AsyncGenerator<ChatStreamEvent>;
}

export class LLMConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LLMConfigError";
  }
}
