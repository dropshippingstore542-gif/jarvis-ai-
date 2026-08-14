import type { Logger } from "@jarvis/core";
import type {
  AutomationRepository,
  AutomationRunRepository,
  ConversationRepository,
} from "../db/repositories/index.js";
import type { HandleMessageParams } from "../brain/orchestrator.js";
import type { BrainEvent } from "../brain/trace.js";
import { computeNextRun } from "./cron.js";

const DEFAULT_TICK_INTERVAL_MS = 30_000;

export interface OrchestratorLike {
  handleUserMessage(params: HandleMessageParams): AsyncGenerator<BrainEvent>;
}

/**
 * Time-based automation engine (spec §16/§17). The server is a persistent
 * long-running process, so this runs in-process on a poll interval — no
 * separate worker needed. Definitions and schedule state live in SQLite, so
 * automations survive a restart (`start()` picks up wherever next_run_at
 * left off instead of re-firing everything that was missed while down).
 *
 * Idempotency: `tick()`'s due-detection and schedule-advance are
 * synchronous SQLite calls, so two overlapping ticks can never both pick up
 * the same due automation — the `running` guard plus moving next_run_at
 * forward before execution starts happen atomically from JS's perspective.
 * See scheduler.test.ts for a direct test of this.
 */
export class Scheduler {
  private timer?: ReturnType<typeof setInterval>;
  private running = new Set<string>();

  constructor(
    private automations: AutomationRepository,
    private runs: AutomationRunRepository,
    private conversations: ConversationRepository,
    private orchestrator: OrchestratorLike,
    private workspaceDir: string,
    private logger: Logger,
    private tickIntervalMs = DEFAULT_TICK_INTERVAL_MS,
  ) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), this.tickIntervalMs);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  /** Finds due automations, reserves + reschedules them synchronously, then executes async. */
  tick(): void {
    const now = new Date();
    const due = this.automations.listDue(now.toISOString());

    for (const automation of due) {
      if (this.running.has(automation.id)) continue;
      this.running.add(automation.id);

      let nextRunAt: string;
      try {
        nextRunAt = computeNextRun(automation.cronExpression, now);
      } catch (err) {
        this.logger.error("Automation has an invalid cron expression — disabling it", {
          automationId: automation.id,
          error: err instanceof Error ? err.message : String(err),
        });
        this.automations.setEnabled(automation.id, false);
        this.running.delete(automation.id);
        continue;
      }
      this.automations.updateNextRun(automation.id, nextRunAt);

      void this.execute(automation.id, automation.prompt, automation.conversationId).finally(() => {
        this.running.delete(automation.id);
      });
    }
  }

  /** Runs a single automation immediately, outside its schedule — does not touch next_run_at. */
  async runNow(automationId: string): Promise<void> {
    const automation = this.automations.get(automationId);
    if (!automation) throw new Error(`Automation "${automationId}" not found.`);
    if (this.running.has(automationId)) throw new Error("This automation is already running.");

    this.running.add(automationId);
    try {
      await this.execute(automation.id, automation.prompt, automation.conversationId);
    } finally {
      this.running.delete(automationId);
    }
  }

  private async execute(automationId: string, prompt: string, conversationId?: string): Promise<void> {
    let convId = conversationId;
    if (!convId) {
      const conversation = this.conversations.create(`Automation: ${automationId}`);
      convId = conversation.id;
      this.automations.setConversationId(automationId, convId);
    }

    const run = this.runs.start(automationId);
    let finalText = "";
    let errorMessage: string | undefined;

    try {
      for await (const event of this.orchestrator.handleUserMessage({
        conversationId: convId,
        userId: "automation",
        workspaceDir: this.workspaceDir,
        text: prompt,
        logger: this.logger.child({ automationId, runId: run.id }),
      })) {
        if (event.type === "message_complete") finalText = event.content;
        if (event.type === "error") errorMessage = event.message;
      }
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
    }

    if (errorMessage) {
      this.runs.finish(run.id, "failure", errorMessage);
      this.automations.recordRunOutcome(automationId, "failure");
      this.logger.warn("Automation run failed", { automationId, error: errorMessage });
    } else {
      this.runs.finish(run.id, "success", finalText || "(no response)");
      this.automations.recordRunOutcome(automationId, "success");
    }
  }
}
