import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppContext } from "../context.js";
import { MemoryPolicyError } from "../memory/memoryService.js";

const memoryTypeEnum = z.enum(["fact", "preference", "project", "task", "routine", "episodic"]);

export function registerMemoryRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get("/api/memories", async (req) => {
    const query = z.object({ q: z.string().optional() }).parse(req.query ?? {});
    return { memories: query.q ? ctx.memoryService.recall(query.q) : ctx.memoryService.list() };
  });

  app.get("/api/memories/proposed", async () => ({
    memories: ctx.memoryService.listProposed(),
  }));

  app.post("/api/memories", async (req, reply) => {
    const body = z
      .object({
        content: z.string().min(3).max(2000),
        type: memoryTypeEnum.optional(),
        tags: z.array(z.string()).optional(),
      })
      .parse(req.body);
    try {
      return ctx.memoryService.remember(body);
    } catch (err) {
      if (err instanceof MemoryPolicyError) return reply.code(400).send({ error: err.message });
      throw err;
    }
  });

  app.patch("/api/memories/:id", async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const body = z
      .object({ content: z.string().min(3).max(2000).optional(), confirm: z.boolean().optional() })
      .parse(req.body);

    let record = body.content ? ctx.memoryService.edit(id, body.content) : undefined;
    if (body.confirm) record = ctx.memoryService.confirm(id);
    if (!record) return reply.code(404).send({ error: "Memory not found" });
    return record;
  });

  app.delete("/api/memories/:id", async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const removed = ctx.memoryService.forget(id);
    if (!removed) return reply.code(404).send({ error: "Memory not found" });
    return { removed: true };
  });

  app.delete("/api/memories", async () => ({ removed: ctx.memoryService.clearAll() }));
}
