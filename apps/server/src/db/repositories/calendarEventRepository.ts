import { nanoid } from "nanoid";
import type { CalendarEvent } from "@jarvis/core";
import type { DB } from "../client.js";

interface CalendarEventRow {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string;
  created_at: string;
  updated_at: string;
}

function fromRow(row: CalendarEventRow): CalendarEvent {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    location: row.location ?? undefined,
    startAt: row.start_at,
    endAt: row.end_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class CalendarEventRepository {
  constructor(private db: DB) {}

  create(input: {
    title: string;
    description?: string;
    location?: string;
    startAt: string;
    endAt: string;
  }): CalendarEvent {
    const now = new Date().toISOString();
    const event: CalendarEvent = {
      id: nanoid(),
      title: input.title,
      description: input.description,
      location: input.location,
      startAt: input.startAt,
      endAt: input.endAt,
      createdAt: now,
      updatedAt: now,
    };
    this.db
      .prepare(
        `INSERT INTO calendar_events (id, title, description, location, start_at, end_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        event.id,
        event.title,
        event.description ?? null,
        event.location ?? null,
        event.startAt,
        event.endAt,
        event.createdAt,
        event.updatedAt,
      );
    return event;
  }

  get(id: string): CalendarEvent | undefined {
    const row = this.db.prepare(`SELECT * FROM calendar_events WHERE id = ?`).get(id) as
      | CalendarEventRow
      | undefined;
    return row ? fromRow(row) : undefined;
  }

  /** All events, soonest first. */
  list(): CalendarEvent[] {
    const rows = this.db
      .prepare(`SELECT * FROM calendar_events ORDER BY start_at ASC`)
      .all() as CalendarEventRow[];
    return rows.map(fromRow);
  }

  listUpcoming(fromIso: string, limit = 20): CalendarEvent[] {
    const rows = this.db
      .prepare(`SELECT * FROM calendar_events WHERE start_at >= ? ORDER BY start_at ASC LIMIT ?`)
      .all(fromIso, limit) as CalendarEventRow[];
    return rows.map(fromRow);
  }

  delete(id: string): boolean {
    return this.db.prepare(`DELETE FROM calendar_events WHERE id = ?`).run(id).changes > 0;
  }
}
