export type MemoryType =
  | "fact"
  | "preference"
  | "project"
  | "task"
  | "routine"
  | "episodic";

export type MemorySource = "user_explicit" | "inferred";

/**
 * Inferred memories start "proposed" and never become durable/searchable
 * defaults until a human confirms them — see SECURITY.md "Memory policy".
 */
export type MemoryStatus = "confirmed" | "proposed";

export interface MemoryRecord {
  id: string;
  type: MemoryType;
  source: MemorySource;
  status: MemoryStatus;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MemorySearchResult {
  memory: MemoryRecord;
  score: number;
}
