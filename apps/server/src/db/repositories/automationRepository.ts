import { nanoid } from "nanoid";
import type { Automation, AutomationRunStatus } from "@jarvis/core";
import type { DB } from "../client.js";

interface AutomationRow {
  id: string;
  name: string;
  cron_expression: string;
  prompt: string;
  enabled: number;
  conversation_id: string | null;
  next_run_at: string | null;
  last_run_at: string | null;
  last_run_status: string | null;
  created_at: string;
  updated_at: string;
}

function fromRow(row: AutomationRow): Automation {
  return {
    id: row.id,
    name: row.name,
    cronExpression: row.cron_expression,
    prompt: row.prompt,
    enabled: row.enabled === 1,
    conversationId: row.conversation_id ?? undefined,
    nextRunAt: row.next_run_at ?? undefined,
    lastRunAt: row.last_run_at ?? undefined,
    lastRunStatus: (row.last_run_status as AutomationRunStatus | null) ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class AutomationRepository {
  constructor(private db: DB) {}

  create(input: { name: string; cronExpression: string; prompt: string; nextRunAt: string }): Automation {
    const now = new Date().toISOString();
    const automation: Automation = {
      id: nanoid(),
      name: input.name,
      cronExpression: input.cronExpression,
      prompt: input.prompt,
      enabled: true,
      nextRunAt: input.nextRunAt,
      createdAt: now,
      updatedAt: now,
    };
    this.db
      .prepare(
        `INSERT INTO automations (id, name, cron_expression, prompt, enabled, next_run_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, ?, ?, ?)`,
      )
      .run(
        automation.id,
        automation.name,
        automation.cronExpression,
        automation.prompt,
        automation.nextRunAt,
        automation.createdAt,
        automation.updatedAt,
      );
    return automation;
  }

  get(id: string): Automation | undefined {
    const row = this.db.prepare(`SELECT * FROM automations WHERE id = ?`).get(id) as
      | AutomationRow
      | undefined;
    return row ? fromRow(row) : undefined;
  }

  list(): Automation[] {
    const rows = this.db
      .prepare(`SELECT * FROM automations ORDER BY created_at DESC`)
      .all() as AutomationRow[];
    return rows.map(fromRow);
  }

  /** Enabled automations whose next_run_at has arrived — the scheduler's due set. */
  listDue(nowIso: string): Automation[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM automations WHERE enabled = 1 AND next_run_at IS NOT NULL AND next_run_at <= ?`,
      )
      .all(nowIso) as AutomationRow[];
    return rows.map(fromRow);
  }

  setEnabled(id: string, enabled: boolean): Automation | undefined {
    this.db
      .prepare(`UPDATE automations SET enabled = ?, updated_at = ? WHERE id = ?`)
      .run(enabled ? 1 : 0, new Date().toISOString(), id);
    return this.get(id);
  }

  setConversationId(id: string, conversationId: string): void {
    this.db
      .prepare(`UPDATE automations SET conversation_id = ?, updated_at = ? WHERE id = ?`)
      .run(conversationId, new Date().toISOString(), id);
  }

  /** Called before executing a due run, to move the schedule forward and prevent duplicate firing. */
  updateNextRun(id: string, nextRunAt: string | null): void {
    this.db
      .prepare(`UPDATE automations SET next_run_at = ?, updated_at = ? WHERE id = ?`)
      .run(nextRunAt, new Date().toISOString(), id);
  }

  recordRunOutcome(id: string, status: AutomationRunStatus): void {
    this.db
      .prepare(`UPDATE automations SET last_run_at = ?, last_run_status = ?, updated_at = ? WHERE id = ?`)
      .run(new Date().toISOString(), status, new Date().toISOString(), id);
  }

  delete(id: string): boolean {
    return this.db.prepare(`DELETE FROM automations WHERE id = ?`).run(id).changes > 0;
  }
}
