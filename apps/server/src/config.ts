import "dotenv/config";
import { z } from "zod";
import path from "node:path";

const envSchema = z.object({
  AI_PROVIDER: z.enum(["anthropic", "openai", "local"]).default("anthropic"),
  AI_MODEL: z.string().default("claude-sonnet-4-5"),
  AI_API_KEY: z.string().optional(),
  AI_BASE_URL: z.string().optional(),

  DATABASE_URL: z.string().default("./data/jarvis.sqlite"),
  JARVIS_WORKSPACE_DIR: z.string().default("./workspace"),

  WEB_SEARCH_PROVIDER: z.enum(["none", "brave", "serpapi"]).default("none"),
  WEB_SEARCH_API_KEY: z.string().optional(),

  TTS_PROVIDER: z.string().default("none"),
  STT_PROVIDER: z.string().default("none"),
  WAKE_WORD: z.string().default("JARVIS"),
  PROACTIVE_MODE: z.enum(["off", "low", "normal", "high"]).default("off"),

  PORT: z.coerce.number().default(4317),
  HOST: z.string().default("127.0.0.1"),
  API_AUTH_TOKEN: z.string().optional(),

  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const env = parsed.data;

export const config = {
  ai: {
    provider: env.AI_PROVIDER,
    model: env.AI_MODEL,
    apiKey: env.AI_API_KEY,
    baseURL: env.AI_BASE_URL,
  },
  databasePath: path.resolve(process.cwd(), env.DATABASE_URL),
  workspaceDir: path.resolve(process.cwd(), env.JARVIS_WORKSPACE_DIR),
  webSearch: {
    provider: env.WEB_SEARCH_PROVIDER,
    apiKey: env.WEB_SEARCH_API_KEY,
  },
  voice: {
    ttsProvider: env.TTS_PROVIDER,
    sttProvider: env.STT_PROVIDER,
    wakeWord: env.WAKE_WORD,
  },
  proactiveMode: env.PROACTIVE_MODE,
  server: {
    port: env.PORT,
    host: env.HOST,
    authToken: env.API_AUTH_TOKEN,
  },
  logLevel: env.LOG_LEVEL,
} as const;

export type Config = typeof config;
