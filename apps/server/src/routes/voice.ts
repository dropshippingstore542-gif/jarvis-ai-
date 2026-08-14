import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppContext } from "../context.js";
import { config } from "../config.js";

/**
 * Real speech-to-text -> orchestrator -> real text-to-speech, reusing the
 * exact same brain pipeline a typed message goes through (memory, tools,
 * permissions, audit all apply identically). Push-to-talk in the browser
 * (apps/web) is the client for this — see ARCHITECTURE.md "Voice" for why
 * continuous wake-word listening is not built here.
 */
export function registerVoiceRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.post("/api/conversations/:id/voice-message", async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const body = z
      .object({ audio: z.object({ mimeType: z.string(), base64: z.string() }) })
      .parse(req.body);

    if (!ctx.sttProvider) {
      return reply.code(400).send({
        error: "Speech-to-text is not configured. Set STT_PROVIDER and VOICE_API_KEY in .env.",
      });
    }

    let transcript: string;
    try {
      transcript = (await ctx.sttProvider.transcribe(body.audio)).text;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.code(502).send({ error: `Speech-to-text failed: ${message}` });
    }

    if (!transcript.trim()) {
      return reply.code(422).send({ error: "Could not transcribe any speech from the recording." });
    }

    ctx.repos.conversations.ensure(id);
    const events = [];
    let finalText = "";
    for await (const event of ctx.orchestrator.handleUserMessage({
      conversationId: id,
      userId: "local-user",
      workspaceDir: config.workspaceDir,
      text: transcript,
      logger: ctx.logger.child({ conversationId: id, channel: "voice" }),
    })) {
      events.push(event);
      ctx.wsHub.broadcast(id, event);
      if (event.type === "message_complete") finalText = event.content;
    }

    let speech: { mimeType: string; base64: string } | undefined;
    if (ctx.ttsProvider && finalText) {
      try {
        speech = (await ctx.ttsProvider.synthesize(finalText)).audio;
      } catch (err) {
        ctx.logger.warn("Text-to-speech failed; returning a text-only reply", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return { transcript, events, speech };
  });
}
