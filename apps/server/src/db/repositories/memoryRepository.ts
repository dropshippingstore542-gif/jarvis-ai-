import { nanoid } from "nanoid";
import type { MemoryRecord, MemoryType, MemorySource, MemoryStatus } from "@jarvis/core";
import type { DB } from "../client.js";

interface MemoryRow {
  id: string;
  type: string;
  source: string;
  status: string;
  content: string;
  tags: string;
  created_at: string;
  updated_at: string;
}

function fromRow(row: MemoryRow): MemoryRecord {
  return {
    id: row.id,
    type: row.type as MemoryType,
    source: row.source as MemorySource,
    status: row.status as MemoryStatus,
    content: row.content,
    tags: JSON.parse(row.tags) as string[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class MemoryRepository {
  constructor(private db: DB) {}

  create(input: {
    type: MemoryType;
    source: MemorySource;
    status: MemoryStatus;
    content: string;
    tags?: string[];
  }): MemoryRecord {
    const now = new Date().toISOString();
    const record: MemoryRecord = {
      id: nanoid(),
      type: input.type,
      source: input.source,
      status: input.status,
      content: input.content,
      tags: input.tags ?? [],
      createdAt: now,
      updatedAt: now,
    };
    this.db
      .prepare(
        `INSERT INTO memories (id, type, source, status, content, tags, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.id,
        record.type,
        record.source,
        record.status,
        record.content,
        JSON.stringify(record.tags),
        record.createdAt,
        record.updatedAt,
      );
    return record;
  }

  get(id: string): MemoryRecord | undefined {
    const row = this.db.prepare(`SELECT * FROM memories WHERE id = ?`).get(id) as
      | MemoryRow
      | undefined;
    return row ? fromRow(row) : undefined;
  }

  list(opts: { status?: MemoryStatus } = {}): MemoryRecord[] {
    const rows = opts.status
      ? (this.db
          .prepare(`SELECT * FROM memories WHERE status = ? ORDER BY updated_at DESC`)
          .all(opts.status) as MemoryRow[])
      : (this.db.prepare(`SELECT * FROM memories ORDER BY updated_at DESC`).all() as MemoryRow[]);
    return rows.map(fromRow);
  }

  /** Naive keyword search — see MemoryIndex for the pluggable-vector-search seam. */
  search(query: string, opts: { status?: MemoryStatus } = {}): MemoryRecord[] {
    const terms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 1);
    if (terms.length === 0) return [];
    return this.list(opts).filter((m) => {
      const haystack = (m.content + " " + m.tags.join(" ")).toLowerCase();
      return terms.some((t) => haystack.includes(t));
    });
  }

  updateStatus(id: string, status: MemoryStatus): MemoryRecord | undefined {
    this.db
      .prepare(`UPDATE memories SET status = ?, updated_at = ? WHERE id = ?`)
      .run(status, new Date().toISOString(), id);
    return this.get(id);
  }

  updateContent(id: string, content: string): MemoryRecord | undefined {
    this.db
      .prepare(`UPDATE memories SET content = ?, updated_at = ? WHERE id = ?`)
      .run(content, new Date().toISOString(), id);
    return this.get(id);
  }

  delete(id: string): boolean {
    const result = this.db.prepare(`DELETE FROM memories WHERE id = ?`).run(id);
    return result.changes > 0;
  }

  clearAll(): number {
    const result = this.db.prepare(`DELETE FROM memories`).run();
    return result.changes;
  }
}
