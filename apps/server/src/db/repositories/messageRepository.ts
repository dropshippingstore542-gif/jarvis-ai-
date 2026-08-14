import { nanoid } from "nanoid";
import type { ChatMessage, ImageAttachment, ToolCallRequest } from "@jarvis/core";
import type { DB } from "../client.js";

export interface StoredMessage extends ChatMessage {
  id: string;
  conversationId: string;
  createdAt: string;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  tool_calls: string | null;
  tool_call_id: string | null;
  tool_name: string | null;
  images: string | null;
  created_at: string;
}

function fromRow(row: MessageRow): StoredMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role as ChatMessage["role"],
    content: row.content,
    toolCalls: row.tool_calls ? (JSON.parse(row.tool_calls) as ToolCallRequest[]) : undefined,
    toolCallId: row.tool_call_id ?? undefined,
    toolName: row.tool_name ?? undefined,
    images: row.images ? (JSON.parse(row.images) as ImageAttachment[]) : undefined,
    createdAt: row.created_at,
  };
}

export class MessageRepository {
  constructor(private db: DB) {}

  append(conversationId: string, message: ChatMessage): StoredMessage {
    const stored: StoredMessage = {
      id: nanoid(),
      conversationId,
      createdAt: new Date().toISOString(),
      ...message,
    };
    this.db
      .prepare(
        `INSERT INTO messages (id, conversation_id, role, content, tool_calls, tool_call_id, tool_name, images, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        stored.id,
        stored.conversationId,
        stored.role,
        stored.content,
        stored.toolCalls ? JSON.stringify(stored.toolCalls) : null,
        stored.toolCallId ?? null,
        stored.toolName ?? null,
        stored.images ? JSON.stringify(stored.images) : null,
        stored.createdAt,
      );
    return stored;
  }

  listByConversation(conversationId: string, limit = 200): StoredMessage[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT ?`,
      )
      .all(conversationId, limit) as MessageRow[];
    return rows.map(fromRow);
  }
}
