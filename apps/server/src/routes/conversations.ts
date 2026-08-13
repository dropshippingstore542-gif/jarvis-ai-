import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppContext } from "../context.js";
import { config } from "../config.js";

export function registerConversationRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get("/api/conversations", async () => ({
    conversations: ctx.repos.conversations.list(),
  }));

  app.post("/api/conversations", async (req) => {
    const body = z.object({ title: z.string().optional() }).parse(req.body ?? {});
    return ctx.repos.conversations.create(body.title);
  });

  app.get("/api/conversations/:id/messages", async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const conversation = ctx.repos.conversations.get(id);
    if (!conversation) return reply.code(404).send({ error: "Conversation not found" });
    return { messages: ctx.repos.messages.listByConversation(id) };
  });

  app.post("/api/conversations/:id/messages", async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const body = z.object({ text: z.string().min(1) }).parse(req.body);
    ctx.repos.conversations.ensure(id);

    const events: unknown[] = [];
    for await (const event of ctx.orchestrator.handleUserMessage({
      conversationId: id,
      userId: "local-user",
      workspaceDir: config.workspaceDir,
      text: body.text,
      logger: ctx.logger.child({ conversationId: id }),
    })) {
      events.push(event);
      ctx.wsHub.broadcast(id, event);
    }
    return { events };
  });
}
