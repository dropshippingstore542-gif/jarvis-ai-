/**
 * Risk tiers a tool declares. See SECURITY.md for the full policy.
 *   safe / low  -> auto-executed (still audited)
 *   medium/high -> requires explicit user approval before execution
 *   high        -> requires a typed confirmation payload, not a bare click
 */
export type PermissionLevel = "safe" | "low" | "medium" | "high";

export const PERMISSION_LEVELS: readonly PermissionLevel[] = [
  "safe",
  "low",
  "medium",
  "high",
];

export function requiresApproval(level: PermissionLevel): boolean {
  return level === "medium" || level === "high";
}

export type PendingActionStatus = "pending" | "approved" | "denied" | "expired";

export interface PendingAction {
  id: string;
  conversationId: string;
  toolName: string;
  input: unknown;
  permission: PermissionLevel;
  reason: string;
  status: PendingActionStatus;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
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
