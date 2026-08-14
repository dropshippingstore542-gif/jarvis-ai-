import { describe, expect, it, vi } from "vitest";
import { openDatabase } from "../db/client.js";
import {
  AutomationRepository,
  AutomationRunRepository,
  ConversationRepository,
} from "../db/repositories/index.js";
import { Scheduler, type OrchestratorLike } from "./scheduler.js";
import { rootLogger } from "../logger.js";
import type { BrainEvent } from "../brain/trace.js";

function setup(orchestrator: OrchestratorLike, tickIntervalMs = 1_000_000) {
  const db = openDatabase(":memory:");
  const automations = new AutomationRepository(db);
  const runs = new AutomationRunRepository(db);
  const conversations = new ConversationRepository(db);
  const scheduler = new Scheduler(
    automations,
    runs,
    conversations,
    orchestrator,
    "/tmp",
    rootLogger.child({ test: "scheduler" }),
    tickIntervalMs,
  );
  return { db, automations, runs, conversations, scheduler };
}

async function* successGenerator(): AsyncGenerator<BrainEvent> {
  yield { type: "status", status: "thinking" };
  yield { type: "message_complete", content: "done" };
}

function pastIso(secondsAgo = 60): string {
  return new Date(Date.now() - secondsAgo * 1000).toISOString();
}

describe("Scheduler", () => {
  it("executes a due automation and reschedules it forward", async () => {
    const handleUserMessage = vi.fn(successGenerator);
    const { automations, runs, scheduler } = setup({ handleUserMessage });

    const automation = automations.create({
      name: "Morning briefing",
      cronExpression: "* * * * *",
      prompt: "Summarize today's tasks.",
      nextRunAt: pastIso(),
    });

    scheduler.tick();
    await new Promise((r) => setTimeout(r, 20));

    expect(handleUserMessage).toHaveBeenCalledTimes(1);
    const updated = automations.get(automation.id);
    expect(updated?.lastRunStatus).toBe("success");
    expect(new Date(updated!.nextRunAt!).getTime()).toBeGreaterThan(Date.now());

    const runHistory = runs.listByAutomation(automation.id);
    expect(runHistory).toHaveLength(1);
    expect(runHistory[0]?.status).toBe("success");
    expect(runHistory[0]?.summary).toBe("done");
  });

  it("never double-fires a due automation across overlapping ticks", async () => {
    let resolveExecution: () => void = () => {};
    const gate = new Promise<void>((r) => (resolveExecution = r));
    const handleUserMessage = vi.fn(async function* (): AsyncGenerator<BrainEvent> {
      await gate;
      yield { type: "message_complete", content: "done" };
    });
    const { automations, scheduler } = setup({ handleUserMessage });

    automations.create({
      name: "Slow automation",
      cronExpression: "* * * * *",
      prompt: "Do a slow thing.",
      nextRunAt: pastIso(),
    });

    scheduler.tick();
    scheduler.tick(); // overlapping tick while the first run is still in flight
    scheduler.tick();

    resolveExecution();
    await new Promise((r) => setTimeout(r, 20));

    expect(handleUserMessage).toHaveBeenCalledTimes(1);
  });

  it("records a failed run without silently reporting success", async () => {
    const handleUserMessage = vi.fn(async function* (): AsyncGenerator<BrainEvent> {
      yield { type: "error", message: "AI provider unavailable" };
    });
    const { automations, runs, scheduler } = setup({ handleUserMessage });

    const automation = automations.create({
      name: "Broken automation",
      cronExpression: "* * * * *",
      prompt: "This will fail.",
      nextRunAt: pastIso(),
    });

    scheduler.tick();
    await new Promise((r) => setTimeout(r, 20));

    expect(automations.get(automation.id)?.lastRunStatus).toBe("failure");
    const runHistory = runs.listByAutomation(automation.id);
    expect(runHistory[0]?.status).toBe("failure");
    expect(runHistory[0]?.summary).toContain("AI provider unavailable");
  });

  it("disables an automation with an invalid cron expression instead of looping forever", async () => {
    const handleUserMessage = vi.fn(successGenerator);
    const { automations, scheduler } = setup({ handleUserMessage });

    const automation = automations.create({
      name: "Bad cron",
      cronExpression: "not-a-cron",
      prompt: "Never runs.",
      nextRunAt: pastIso(),
    });

    scheduler.tick();
    await new Promise((r) => setTimeout(r, 20));

    expect(handleUserMessage).not.toHaveBeenCalled();
    expect(automations.get(automation.id)?.enabled).toBe(false);
  });

  it("runNow executes immediately without touching the schedule", async () => {
    const handleUserMessage = vi.fn(successGenerator);
    const { automations, scheduler } = setup({ handleUserMessage });

    const automation = automations.create({
      name: "Manual run",
      cronExpression: "0 0 1 1 *", // once a year — nextRunAt is far in the future
      prompt: "Run me now.",
      nextRunAt: new Date(Date.now() + 1e9).toISOString(),
    });
    const originalNextRun = automations.get(automation.id)!.nextRunAt;

    await scheduler.runNow(automation.id);

    expect(handleUserMessage).toHaveBeenCalledTimes(1);
    const updated = automations.get(automation.id);
    expect(updated?.nextRunAt).toBe(originalNextRun);
    expect(updated?.lastRunStatus).toBe("success");
  });
});
