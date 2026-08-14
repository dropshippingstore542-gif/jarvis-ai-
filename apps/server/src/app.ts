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
import { registerVoiceRoutes } from "./routes/voice.js";
import { registerCalendarRoutes } from "./routes/calendar.js";

export async function buildApp(ctx: AppContext) {
  // Default 1MB body limit is too small for base64-encoded audio uploads (voice-message).
  const app = Fastify({ logger: false, bodyLimit: 25 * 1024 * 1024 });

  await app.register(cors, { origin: true });
  await app.register(websocket);

  app.addHook("onRequest", (req, reply, done) => {
    // calendar.ics uses its own ?token= check (see routes/calendar.ts) —
    // calendar apps polling the feed can't send a custom Authorization header.
    if (req.url === "/health" || req.url.startsWith("/api/calendar.ics")) return done();
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
  registerVoiceRoutes(app, ctx);
  registerCalendarRoutes(app, ctx);
  registerWsRoutes(app, ctx);

  return app;
}
