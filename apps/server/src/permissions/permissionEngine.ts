import { requiresApproval } from "@jarvis/core";
import type { PendingAction, PermissionLevel } from "@jarvis/core";
import type { PendingActionRepository } from "../db/repositories/index.js";

export type PermissionEvent =
  | { type: "pending_action_created"; action: PendingAction }
  | { type: "pending_action_resolved"; action: PendingAction };

export interface AuthorizeParams {
  conversationId: string;
  toolName: string;
  input: unknown;
  permission: PermissionLevel;
  reason: string;
}

export interface AuthorizeResult {
  approved: boolean;
  pendingActionId?: string;
}

const DEFAULT_APPROVAL_TIMEOUT_MS = 15 * 60 * 1000;

/**
 * Gate between "the brain wants to run a tool" and "the tool actually
 * runs". safe/low permission tools pass straight through (still audited by
 * the caller). medium/high create a pending_actions row, push a
 * `pending_action_created` event to the frontend, and block until a human
 * calls resolve() via the approvals REST endpoint — or the request times
 * out and is treated as a denial. Nothing here ever auto-approves a
 * medium/high action.
 */
export class PermissionEngine {
  private waiters = new Map<string, (approved: boolean) => void>();

  constructor(
    private pendingActions: PendingActionRepository,
    private emit: (event: PermissionEvent) => void,
    private approvalTimeoutMs = DEFAULT_APPROVAL_TIMEOUT_MS,
  ) {}

  async authorize(params: AuthorizeParams): Promise<AuthorizeResult> {
    if (!requiresApproval(params.permission)) {
      return { approved: true };
    }

    const action = this.pendingActions.create(params);
    this.emit({ type: "pending_action_created", action });

    const approved = await new Promise<boolean>((resolve) => {
      this.waiters.set(action.id, resolve);
      setTimeout(() => {
        if (this.waiters.has(action.id)) {
          this.waiters.delete(action.id);
          this.pendingActions.resolve(action.id, "expired", "system:timeout");
          const resolved = this.pendingActions.get(action.id);
          if (resolved) this.emit({ type: "pending_action_resolved", action: resolved });
          resolve(false);
        }
      }, this.approvalTimeoutMs);
    });

    return { approved, pendingActionId: action.id };
  }

  resolve(id: string, approved: boolean, resolvedBy: string): PendingAction | undefined {
    const waiter = this.waiters.get(id);
    const action = this.pendingActions.resolve(id, approved ? "approved" : "denied", resolvedBy);
    if (waiter) {
      this.waiters.delete(id);
      waiter(approved);
    }
    if (action) this.emit({ type: "pending_action_resolved", action });
    return action;
  }

  listPending(): PendingAction[] {
    return this.pendingActions.listPending();
  }
}
