import { nanoid } from "nanoid";
import type { PendingAction, PermissionLevel, PendingActionStatus } from "@jarvis/core";
import type { DB } from "../client.js";

interface PendingActionRow {
  id: string;
  conversation_id: string;
  tool_name: string;
  input: string;
  permission: string;
  reason: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

function fromRow(row: PendingActionRow): PendingAction {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    toolName: row.tool_name,
    input: JSON.parse(row.input) as unknown,
    permission: row.permission as PermissionLevel,
    reason: row.reason,
    status: row.status as PendingActionStatus,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at ?? undefined,
    resolvedBy: row.resolved_by ?? undefined,
  };
}

export class PendingActionRepository {
  constructor(private db: DB) {}

  create(input: {
    conversationId: string;
    toolName: string;
    input: unknown;
    permission: PermissionLevel;
    reason: string;
  }): PendingAction {
    const action: PendingAction = {
      id: nanoid(),
      conversationId: input.conversationId,
      toolName: input.toolName,
      input: input.input,
      permission: input.permission,
      reason: input.reason,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    this.db
      .prepare(
        `INSERT INTO pending_actions (id, conversation_id, tool_name, input, permission, reason, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        action.id,
        action.conversationId,
        action.toolName,
        JSON.stringify(action.input),
        action.permission,
        action.reason,
        action.status,
        action.createdAt,
      );
    return action;
  }

  get(id: string): PendingAction | undefined {
    const row = this.db.prepare(`SELECT * FROM pending_actions WHERE id = ?`).get(id) as
      | PendingActionRow
      | undefined;
    return row ? fromRow(row) : undefined;
  }

  listPending(): PendingAction[] {
    const rows = this.db
      .prepare(`SELECT * FROM pending_actions WHERE status = 'pending' ORDER BY created_at ASC`)
      .all() as PendingActionRow[];
    return rows.map(fromRow);
  }

  resolve(id: string, status: "approved" | "denied" | "expired", resolvedBy: string): PendingAction | undefined {
    this.db
      .prepare(
        `UPDATE pending_actions SET status = ?, resolved_at = ?, resolved_by = ? WHERE id = ?`,
      )
      .run(status, new Date().toISOString(), resolvedBy, id);
    return this.get(id);
  }
}
