import type { FastifyInstance } from "fastify";
import type { AppContext } from "../context.js";

export function registerToolRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get("/api/tools", async () => ({
    tools: ctx.toolRegistry.list().map((t) => ({
      name: t.name,
      description: t.description,
      permission: t.permission,
    })),
  }));
}
