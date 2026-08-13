import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppContext } from "../context.js";
import { config } from "../config.js";

/**
 * AI provider/model/voice config comes from .env (process-level, requires a
 * restart to change — deliberate, avoids silently swapping providers/keys
 * mid-session). `custom` holds arbitrary UI-editable preferences (e.g.
 * response-length preference) persisted in the settings table.
 */
export function registerSettingsRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get("/api/settings", async () => ({
    ai: { provider: config.ai.provider, model: config.ai.model },
    voice: { wakeWord: config.voice.wakeWord, ttsProvider: config.voice.ttsProvider, sttProvider: config.voice.sttProvider },
    proactiveMode: config.proactiveMode,
    webSearchProvider: config.webSearch.provider,
    custom: ctx.repos.settings.all(),
  }));

  app.put("/api/settings/:key", async (req) => {
    const { key } = z.object({ key: z.string() }).parse(req.params);
    const body = z.object({ value: z.string() }).parse(req.body);
    ctx.repos.settings.set(key, body.value);
    return { key, value: body.value };
  });
}
