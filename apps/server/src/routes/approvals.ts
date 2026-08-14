import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppContext } from "../context.js";

export function registerApprovalRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get("/api/approvals", async () => ({ pending: ctx.permissionEngine.listPending() }));

  app.post("/api/approvals/:id/resolve", async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const body = z.object({ approved: z.boolean() }).parse(req.body);
    const resolved = ctx.permissionEngine.resolve(id, body.approved, "local-user");
    if (!resolved) return reply.code(404).send({ error: "Pending action not found" });
    return resolved;
  });
}
