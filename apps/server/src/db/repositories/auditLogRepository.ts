import { nanoid } from "nanoid";
import type { AuditLogEntry, PermissionLevel } from "@jarvis/core";
import type { DB } from "../client.js";

interface AuditLogRow {
  id: string;
  timestamp: string;
  conversation_id: string | null;
  tool_name: string;
  input_summary: string;
  permission: string;
  approved: number;
  approved_by: string | null;
  result: string;
  error_message: string | null;
  duration_ms: number;
}

function fromRow(row: AuditLogRow): AuditLogEntry {
  return {
    id: row.id,
    timestamp: row.timestamp,
    conversationId: row.conversation_id ?? undefined,
    toolName: row.tool_name,
    inputSummary: row.input_summary,
    permission: row.permission as PermissionLevel,
    approved: row.approved === 1,
    approvedBy: row.approved_by ?? undefined,
    result: row.result as AuditLogEntry["result"],
    errorMessage: row.error_message ?? undefined,
    durationMs: row.duration_ms,
  };
}

export class AuditLogRepository {
  constructor(private db: DB) {}

  record(entry: Omit<AuditLogEntry, "id" | "timestamp"> & { timestamp?: string }): AuditLogEntry {
    const full: AuditLogEntry = {
      id: nanoid(),
      timestamp: entry.timestamp ?? new Date().toISOString(),
      ...entry,
    };
    this.db
      .prepare(
        `INSERT INTO audit_log (id, timestamp, conversation_id, tool_name, input_summary, permission, approved, approved_by, result, error_message, duration_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        full.id,
        full.timestamp,
        full.conversationId ?? null,
        full.toolName,
        full.inputSummary,
        full.permission,
        full.approved ? 1 : 0,
        full.approvedBy ?? null,
        full.result,
        full.errorMessage ?? null,
        full.durationMs,
      );
    return full;
  }

  list(limit = 200): AuditLogEntry[] {
    const rows = this.db
      .prepare(`SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT ?`)
      .all(limit) as AuditLogRow[];
    return rows.map(fromRow);
  }
}
