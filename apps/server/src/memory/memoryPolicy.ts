import type { MemorySource, MemoryStatus } from "@jarvis/core";

/**
 * The assistant must not save everything blindly (spec section 9/24).
 * Explicit "remember that..." requests are trusted and confirmed
 * immediately. Anything inferred from conversation is stored as
 * "proposed" and stays invisible to recall until a human confirms it —
 * see MemoryService.confirm().
 */
export function decideInitialStatus(source: MemorySource): MemoryStatus {
  return source === "user_explicit" ? "confirmed" : "proposed";
}

export function isEligibleForStorage(content: string): boolean {
  const trimmed = content.trim();
  return trimmed.length >= 3 && trimmed.length <= 2000;
}
