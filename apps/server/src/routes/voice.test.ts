import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import { registerVoiceRoutes } from "./voice.js";
import { openDatabase } from "../db/client.js";
import { createRepositories } from "../db/repositories/index.js";
import { WsHub } from "../ws/wsHub.js";
import { rootLogger } from "../logger.js";
import type { AppContext } from "../context.js";
import type { BrainEvent } from "../brain/trace.js";
import type { HandleMessageParams } from "../brain/orchestrator.js";

function buildTestApp(overrides: Partial<AppContext> = {}) {
  const db = openDatabase(":memory:");
  const repos = createRepositories(db);
  const ctx = {
    repos,
    wsHub: new WsHub(),
    logger: rootLogger,
    orchestrator: {
      async *handleUserMessage(_params: HandleMessageParams): AsyncGenerator<BrainEvent> {
        yield { type: "status", status: "thinking" };
        yield { type: "message_complete", content: "I heard you." };
      },
    },
    ...overrides,
  } as unknown as AppContext;

  const app = Fastify();
  registerVoiceRoutes(app, ctx);
  return { app, ctx };
}

describe("POST /api/conversations/:id/voice-message", () => {
  it("returns 400 and never calls the orchestrator when STT isn't configured", async () => {
    const { app } = buildTestApp({ sttProvider: undefined });
    const res = await app.inject({
      method: "POST",
      url: "/api/conversations/c1/voice-message",
      payload: { audio: { mimeType: "audio/webm", base64: "AAAA" } },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/speech-to-text is not configured/i);
  });

  it("transcribes, runs the message through the orchestrator, and synthesizes a reply", async () => {
    const { app } = buildTestApp({
      sttProvider: { name: "fake", async transcribe() { return { text: "hello jarvis" }; } },
      ttsProvider: {
        name: "fake",
        async synthesize(text: string) {
          return { audio: { mimeType: "audio/mpeg", base64: Buffer.from(text).toString("base64") } };
        },
      },
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/conversations/c1/voice-message",
      payload: { audio: { mimeType: "audio/webm", base64: "AAAA" } },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.transcript).toBe("hello jarvis");
    expect(body.events.some((e: BrainEvent) => e.type === "message_complete")).toBe(true);
    expect(body.speech.mimeType).toBe("audio/mpeg");
    expect(Buffer.from(body.speech.base64, "base64").toString()).toBe("I heard you.");
  });

  it("returns 502 (not a fabricated transcript) when transcription itself fails", async () => {
    const { app } = buildTestApp({
      sttProvider: {
        name: "fake",
        async transcribe() {
          throw new Error("upstream unavailable");
        },
      },
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/conversations/c1/voice-message",
      payload: { audio: { mimeType: "audio/webm", base64: "AAAA" } },
    });
    expect(res.statusCode).toBe(502);
    expect(JSON.parse(res.body).error).toContain("upstream unavailable");
  });

  it("still returns the text reply when TTS is unconfigured or fails", async () => {
    const { app } = buildTestApp({
      sttProvider: { name: "fake", async transcribe() { return { text: "hi" }; } },
      ttsProvider: undefined,
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/conversations/c1/voice-message",
      payload: { audio: { mimeType: "audio/webm", base64: "AAAA" } },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.transcript).toBe("hi");
    expect(body.speech).toBeUndefined();
  });
});
