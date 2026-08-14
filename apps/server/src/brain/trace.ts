export type AssistantStatus =
  | "listening"
  | "thinking"
  | "working"
  | "waiting_for_approval"
  | "speaking"
  | "idle";

/**
 * Structured, safe execution metadata for the observability panel (spec
 * section 36). Deliberately does not include model chain-of-thought —
 * only what tool ran, with what arguments, and what came back.
 */
export type BrainEvent =
  | { type: "status"; status: AssistantStatus }
  | { type: "text_delta"; text: string }
  | { type: "tool_started"; toolName: string; input: unknown }
  | { type: "tool_awaiting_approval"; toolName: string; pendingActionId: string }
  | { type: "tool_result"; toolName: string; output: unknown; verified?: boolean; note?: string }
  | { type: "tool_error"; toolName: string; error: string }
  | { type: "message_complete"; content: string }
  | { type: "error"; message: string };
