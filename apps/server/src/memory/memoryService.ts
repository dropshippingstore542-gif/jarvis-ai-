import type { MemoryRecord, MemoryType, MemorySource } from "@jarvis/core";
import type { MemoryRepository } from "../db/repositories/index.js";
import { decideInitialStatus, isEligibleForStorage } from "./memoryPolicy.js";

export class MemoryPolicyError extends Error {}

export class MemoryService {
  constructor(private repo: MemoryRepository) {}

  remember(input: {
    content: string;
    type?: MemoryType;
    tags?: string[];
    source?: MemorySource;
  }): MemoryRecord {
    if (!isEligibleForStorage(input.content)) {
      throw new MemoryPolicyError(
        "Memory content must be between 3 and 2000 characters.",
      );
    }
    const source = input.source ?? "user_explicit";
    return this.repo.create({
      type: input.type ?? "fact",
      source,
      status: decideInitialStatus(source),
      content: input.content.trim(),
      tags: input.tags ?? [],
    });
  }

  /** Confirmed memories only — proposed/inferred memories stay out of recall until confirmed. */
  recall(query?: string): MemoryRecord[] {
    if (query && query.trim().length > 0) {
      return this.repo.search(query, { status: "confirmed" });
    }
    return this.repo.list({ status: "confirmed" });
  }

  list(): MemoryRecord[] {
    return this.repo.list();
  }

  listProposed(): MemoryRecord[] {
    return this.repo.list({ status: "proposed" });
  }

  confirm(id: string): MemoryRecord | undefined {
    return this.repo.updateStatus(id, "confirmed");
  }

  edit(id: string, content: string): MemoryRecord | undefined {
    if (!isEligibleForStorage(content)) {
      throw new MemoryPolicyError("Memory content must be between 3 and 2000 characters.");
    }
    return this.repo.updateContent(id, content.trim());
  }

  forget(id: string): boolean {
    return this.repo.delete(id);
  }

  /** Forgets every confirmed memory whose content matches the query (case-insensitive substring). */
  forgetMatching(query: string): number {
    const matches = this.repo.search(query);
    let count = 0;
    for (const m of matches) {
      if (this.repo.delete(m.id)) count++;
    }
    return count;
  }

  clearAll(): number {
    return this.repo.clearAll();
  }
}
