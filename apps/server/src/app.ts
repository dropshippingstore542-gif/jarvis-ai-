import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import type { AppContext } from "./context.js";
import { checkAuth } from "./auth.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerConversationRoutes } from "./routes/conversations.js";
import { registerToolRoutes } from "./routes/tools.js";
import { registerMemoryRoutes } from "./routes/memories.js";
import { registerAuditRoutes } from "./routes/audit.js";
import { registerApprovalRoutes } from "./routes/approvals.js";
import { registerSettingsRoutes } from "./routes/settings.js";
import { registerWsRoutes } from "./routes/ws.js";
import { registerAutomationRoutes } from "./routes/automations.js";

export async function buildApp(ctx: AppContext) {
  const app = Fastify({ logger: false });

  await app.register(cors, { origin: true });
  await app.register(websocket);

  app.addHook("onRequest", (req, reply, done) => {
    if (req.url === "/health") return done();
    checkAuth(req, reply, done);
  });

  registerHealthRoutes(app);
  registerConversationRoutes(app, ctx);
  registerToolRoutes(app, ctx);
  registerMemoryRoutes(app, ctx);
  registerAuditRoutes(app, ctx);
  registerApprovalRoutes(app, ctx);
  registerSettingsRoutes(app, ctx);
  registerAutomationRoutes(app, ctx);
  registerWsRoutes(app, ctx);

  return app;
}
