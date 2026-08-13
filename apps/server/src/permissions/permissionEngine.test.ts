import { describe, expect, it, vi } from "vitest";
import { openDatabase } from "../db/client.js";
import { PendingActionRepository } from "../db/repositories/index.js";
import { PermissionEngine } from "./permissionEngine.js";

function setup(approvalTimeoutMs?: number) {
  const db = openDatabase(":memory:");
  const repo = new PendingActionRepository(db);
  const emit = vi.fn();
  const engine = new PermissionEngine(repo, emit, approvalTimeoutMs);
  return { engine, repo, emit };
}

describe("PermissionEngine", () => {
  it("auto-approves safe and low permission actions without creating a pending action", async () => {
    const { engine, repo, emit } = setup();

    const safe = await engine.authorize({
      conversationId: "c1",
      toolName: "memory.recall",
      input: {},
      permission: "safe",
      reason: "test",
    });
    const low = await engine.authorize({
      conversationId: "c1",
      toolName: "filesystem.write",
      input: {},
      permission: "low",
      reason: "test",
    });

    expect(safe).toEqual({ approved: true });
    expect(low).toEqual({ approved: true });
    expect(repo.listPending()).toHaveLength(0);
    expect(emit).not.toHaveBeenCalled();
  });

  it("blocks medium/high actions until explicitly resolved, and approving unblocks it", async () => {
    const { engine, repo, emit } = setup();

    const authorizePromise = engine.authorize({
      conversationId: "c1",
      toolName: "email.send",
      input: { to: "supplier@example.com" },
      permission: "high",
      reason: "assistant wants to send an email",
    });

    // give the microtask queue a tick so the pending action is created before we inspect it
    await new Promise((r) => setTimeout(r, 10));
    const pending = repo.listPending();
    expect(pending).toHaveLength(1);
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: "pending_action_created" }),
    );

    const resolved = engine.resolve(pending[0]!.id, true, "test-user");
    expect(resolved?.status).toBe("approved");

    const result = await authorizePromise;
    expect(result.approved).toBe(true);
    expect(repo.listPending()).toHaveLength(0);
  });

  it("denying a pending action reports approved:false and never executes", async () => {
    const { engine, repo } = setup();

    const authorizePromise = engine.authorize({
      conversationId: "c1",
      toolName: "filesystem.write",
      input: {},
      permission: "medium",
      reason: "test",
    });
    await new Promise((r) => setTimeout(r, 10));
    const pending = repo.listPending();
    engine.resolve(pending[0]!.id, false, "test-user");

    const result = await authorizePromise;
    expect(result.approved).toBe(false);
  });

  it("treats an approval timeout as a terminal denial, not a silent retry", async () => {
    const { engine, repo } = setup(30);

    const result = await engine.authorize({
      conversationId: "c1",
      toolName: "email.send",
      input: {},
      permission: "high",
      reason: "test",
    });

    expect(result.approved).toBe(false);
    const action = repo.get(result.pendingActionId!);
    expect(action?.status).toBe("expired");
  });
});
