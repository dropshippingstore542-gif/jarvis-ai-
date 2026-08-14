import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppContext } from "../context.js";
import { computeNextRun, validateCronExpression, InvalidCronExpressionError } from "../automation/cron.js";

export function registerAutomationRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get("/api/automations", async () => ({ automations: ctx.repos.automations.list() }));

  app.post("/api/automations", async (req, reply) => {
    const body = z
      .object({ name: z.string().min(1), cronExpression: z.string().min(1), prompt: z.string().min(1) })
      .parse(req.body);
    try {
      validateCronExpression(body.cronExpression);
    } catch (err) {
      if (err instanceof InvalidCronExpressionError) return reply.code(400).send({ error: err.message });
      throw err;
    }
    const nextRunAt = computeNextRun(body.cronExpression);
    return ctx.repos.automations.create({ ...body, nextRunAt });
  });

  app.patch("/api/automations/:id", async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const body = z.object({ enabled: z.boolean() }).parse(req.body);
    const automation = ctx.repos.automations.get(id);
    if (!automation) return reply.code(404).send({ error: "Automation not found" });

    const updated = ctx.repos.automations.setEnabled(id, body.enabled);
    // Re-arm the schedule from now if it was disabled long enough that next_run_at is stale.
    if (body.enabled && updated && (!updated.nextRunAt || new Date(updated.nextRunAt) < new Date())) {
      ctx.repos.automations.updateNextRun(id, computeNextRun(updated.cronExpression));
    }
    return ctx.repos.automations.get(id);
  });

  app.delete("/api/automations/:id", async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const removed = ctx.repos.automations.delete(id);
    if (!removed) return reply.code(404).send({ error: "Automation not found" });
    return { removed: true };
  });

  app.post("/api/automations/:id/run", async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    try {
      await ctx.scheduler.runNow(id);
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : String(err) });
    }
    return ctx.repos.automations.get(id);
  });

  app.get("/api/automations/:id/runs", async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    return { runs: ctx.repos.automationRuns.listByAutomation(id) };
  });
}
