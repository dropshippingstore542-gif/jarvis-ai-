export type PermissionLevel = "safe" | "low" | "medium" | "high";

export type AssistantStatus =
  | "listening"
  | "thinking"
  | "working"
  | "waiting_for_approval"
  | "speaking"
  | "idle";

export type BrainEvent =
  | { type: "status"; status: AssistantStatus }
  | { type: "text_delta"; text: string }
  | { type: "tool_started"; toolName: string; input: unknown }
  | { type: "tool_awaiting_approval"; toolName: string; pendingActionId: string }
  | { type: "tool_result"; toolName: string; output: unknown; verified?: boolean; note?: string }
  | { type: "tool_error"; toolName: string; error: string }
  | { type: "message_complete"; content: string }
  | { type: "error"; message: string }
  | { type: "pending_action_created"; action: PendingAction }
  | { type: "pending_action_resolved"; action: PendingAction };

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredMessage {
  id: string;
  conversationId: string;
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolName?: string;
  createdAt: string;
}

export interface MemoryRecord {
  id: string;
  type: string;
  source: "user_explicit" | "inferred";
  status: "confirmed" | "proposed";
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PendingAction {
  id: string;
  conversationId: string;
  toolName: string;
  input: unknown;
  permission: PermissionLevel;
  reason: string;
  status: "pending" | "approved" | "denied" | "expired";
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  conversationId?: string;
  toolName: string;
  inputSummary: string;
  permission: PermissionLevel;
  approved: boolean;
  approvedBy?: string;
  result: "success" | "failure" | "denied";
  errorMessage?: string;
  durationMs: number;
}

export interface ToolInfo {
  name: string;
  description: string;
  permission: PermissionLevel;
}

export interface ActivityEntry {
  id: string;
  toolName: string;
  input?: unknown;
  output?: unknown;
  status: "running" | "success" | "error" | "awaiting_approval";
  error?: string;
  verified?: boolean;
}
