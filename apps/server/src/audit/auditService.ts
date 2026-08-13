import type { AuditLogEntry, PermissionLevel } from "@jarvis/core";
import type { AuditLogRepository } from "../db/repositories/index.js";

function summarize(input: unknown): string {
  try {
    const json = JSON.stringify(input);
    return json.length > 500 ? json.slice(0, 500) + "…" : json;
  } catch {
    return String(input);
  }
}

/** Every tool execution — auto or approved — must produce exactly one audit row. */
export class AuditService {
  constructor(private repo: AuditLogRepository) {}

  recordSuccess(params: {
    conversationId?: string;
    toolName: string;
    input: unknown;
    permission: PermissionLevel;
    approved: boolean;
    approvedBy?: string;
    durationMs: number;
  }): AuditLogEntry {
    return this.repo.record({
      conversationId: params.conversationId,
      toolName: params.toolName,
      inputSummary: summarize(params.input),
      permission: params.permission,
      approved: params.approved,
      approvedBy: params.approvedBy,
      result: "success",
      durationMs: params.durationMs,
    });
  }

  recordFailure(params: {
    conversationId?: string;
    toolName: string;
    input: unknown;
    permission: PermissionLevel;
    approved: boolean;
    approvedBy?: string;
    errorMessage: string;
    durationMs: number;
  }): AuditLogEntry {
    return this.repo.record({
      conversationId: params.conversationId,
      toolName: params.toolName,
      inputSummary: summarize(params.input),
      permission: params.permission,
      approved: params.approved,
      approvedBy: params.approvedBy,
      result: "failure",
      errorMessage: params.errorMessage,
      durationMs: params.durationMs,
    });
  }

  recordDenied(params: {
    conversationId?: string;
    toolName: string;
    input: unknown;
    permission: PermissionLevel;
  }): AuditLogEntry {
    return this.repo.record({
      conversationId: params.conversationId,
      toolName: params.toolName,
      inputSummary: summarize(params.input),
      permission: params.permission,
      approved: false,
      result: "denied",
      durationMs: 0,
    });
  }

  list(limit?: number): AuditLogEntry[] {
    return this.repo.list(limit);
  }
}
