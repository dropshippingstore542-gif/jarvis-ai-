import type { FastifyInstance } from "fastify";
import { config } from "../config.js";

export function registerHealthRoutes(app: FastifyInstance): void {
  app.get("/health", async () => ({
    status: "ok",
    provider: config.ai.provider,
    model: config.ai.model,
    time: new Date().toISOString(),
  }));
}
