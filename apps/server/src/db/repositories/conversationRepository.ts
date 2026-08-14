import { nanoid } from "nanoid";
import type { DB } from "../client.js";

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface ConversationRow {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

function fromRow(row: ConversationRow): Conversation {
  return { id: row.id, title: row.title, createdAt: row.created_at, updatedAt: row.updated_at };
}

export class ConversationRepository {
  constructor(private db: DB) {}

  create(title = "New conversation"): Conversation {
    const now = new Date().toISOString();
    const conversation: Conversation = { id: nanoid(), title, createdAt: now, updatedAt: now };
    this.db
      .prepare(
        `INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)`,
      )
      .run(conversation.id, conversation.title, conversation.createdAt, conversation.updatedAt);
    return conversation;
  }

  get(id: string): Conversation | undefined {
    const row = this.db
      .prepare(`SELECT * FROM conversations WHERE id = ?`)
      .get(id) as ConversationRow | undefined;
    return row ? fromRow(row) : undefined;
  }

  list(): Conversation[] {
    const rows = this.db
      .prepare(`SELECT * FROM conversations ORDER BY updated_at DESC`)
      .all() as ConversationRow[];
    return rows.map(fromRow);
  }

  touch(id: string): void {
    this.db
      .prepare(`UPDATE conversations SET updated_at = ? WHERE id = ?`)
      .run(new Date().toISOString(), id);
  }

  ensure(id: string): Conversation {
    const existing = this.get(id);
    if (existing) return existing;
    const now = new Date().toISOString();
    const conversation: Conversation = { id, title: "New conversation", createdAt: now, updatedAt: now };
    this.db
      .prepare(
        `INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)`,
      )
      .run(conversation.id, conversation.title, conversation.createdAt, conversation.updatedAt);
    return conversation;
  }
}
