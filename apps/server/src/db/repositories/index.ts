import type { DB } from "../client.js";
import { ConversationRepository } from "./conversationRepository.js";
import { MessageRepository } from "./messageRepository.js";
import { MemoryRepository } from "./memoryRepository.js";
import { PendingActionRepository } from "./pendingActionRepository.js";
import { AuditLogRepository } from "./auditLogRepository.js";
import { SettingsRepository } from "./settingsRepository.js";

export * from "./conversationRepository.js";
export * from "./messageRepository.js";
export * from "./memoryRepository.js";
export * from "./pendingActionRepository.js";
export * from "./auditLogRepository.js";
export * from "./settingsRepository.js";

export interface Repositories {
  conversations: ConversationRepository;
  messages: MessageRepository;
  memories: MemoryRepository;
  pendingActions: PendingActionRepository;
  auditLog: AuditLogRepository;
  settings: SettingsRepository;
}

export function createRepositories(db: DB): Repositories {
  return {
    conversations: new ConversationRepository(db),
    messages: new MessageRepository(db),
    memories: new MemoryRepository(db),
    pendingActions: new PendingActionRepository(db),
    auditLog: new AuditLogRepository(db),
    settings: new SettingsRepository(db),
  };
}
