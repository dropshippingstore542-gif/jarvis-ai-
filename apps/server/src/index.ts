import { config } from "./config.js";
import { rootLogger } from "./logger.js";
import { createAppContext } from "./context.js";
import { buildApp } from "./app.js";

async function main() {
  const logger = rootLogger;
  const ctx = await createAppContext(logger);
  const app = await buildApp(ctx);

  await app.listen({ port: config.server.port, host: config.server.host });
  logger.info(`Jarvis server listening on http://${config.server.host}:${config.server.port}`, {
    provider: config.ai.provider,
    model: config.ai.model,
  });

  ctx.scheduler.start();

  const shutdown = async () => {
    logger.info("Shutting down…");
    ctx.scheduler.stop();
    await ctx.browserManager.shutdown();
    await app.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Fatal error starting Jarvis server:", err);
  process.exit(1);
});
