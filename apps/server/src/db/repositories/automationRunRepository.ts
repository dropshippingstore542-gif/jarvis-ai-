import { nanoid } from "nanoid";
import type { AutomationRun, AutomationRunStatus } from "@jarvis/core";
import type { DB } from "../client.js";

interface AutomationRunRow {
  id: string;
  automation_id: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  summary: string | null;
}

function fromRow(row: AutomationRunRow): AutomationRun {
  return {
    id: row.id,
    automationId: row.automation_id,
    startedAt: row.started_at,
    finishedAt: row.finished_at ?? undefined,
    status: row.status as AutomationRunStatus,
    summary: row.summary ?? undefined,
  };
}

export class AutomationRunRepository {
  constructor(private db: DB) {}

  start(automationId: string): AutomationRun {
    const run: AutomationRun = {
      id: nanoid(),
      automationId,
      startedAt: new Date().toISOString(),
      status: "running",
    };
    this.db
      .prepare(`INSERT INTO automation_runs (id, automation_id, started_at, status) VALUES (?, ?, ?, ?)`)
      .run(run.id, run.automationId, run.startedAt, run.status);
    return run;
  }

  finish(id: string, status: "success" | "failure", summary: string): AutomationRun | undefined {
    this.db
      .prepare(`UPDATE automation_runs SET status = ?, finished_at = ?, summary = ? WHERE id = ?`)
      .run(status, new Date().toISOString(), summary, id);
    const row = this.db.prepare(`SELECT * FROM automation_runs WHERE id = ?`).get(id) as
      | AutomationRunRow
      | undefined;
    return row ? fromRow(row) : undefined;
  }

  listByAutomation(automationId: string, limit = 50): AutomationRun[] {
    const rows = this.db
      .prepare(`SELECT * FROM automation_runs WHERE automation_id = ? ORDER BY started_at DESC LIMIT ?`)
      .all(automationId, limit) as AutomationRunRow[];
    return rows.map(fromRow);
  }
}
