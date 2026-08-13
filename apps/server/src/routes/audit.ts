import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppContext } from "../context.js";

export function registerAuditRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get("/api/audit-log", async (req) => {
    const query = z.object({ limit: z.coerce.number().optional() }).parse(req.query ?? {});
    return { entries: ctx.auditService.list(query.limit) };
  });
}
