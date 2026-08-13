import type { Logger } from "@jarvis/core";
import { config } from "./config.js";

const LEVELS = ["debug", "info", "warn", "error"] as const;
type Level = (typeof LEVELS)[number];

function shouldLog(level: Level): boolean {
  return LEVELS.indexOf(level) >= LEVELS.indexOf(config.logLevel);
}

function createLogger(bindings: Record<string, unknown> = {}): Logger {
  const write = (level: Level, msg: string, meta?: Record<string, unknown>) => {
    if (!shouldLog(level)) return;
    const entry = {
      time: new Date().toISOString(),
      level,
      msg,
      ...bindings,
      ...meta,
    };
    const line = JSON.stringify(entry);
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  };

  return {
    debug: (msg, meta) => write("debug", msg, meta),
    info: (msg, meta) => write("info", msg, meta),
    warn: (msg, meta) => write("warn", msg, meta),
    error: (msg, meta) => write("error", msg, meta),
    child: (childBindings) => createLogger({ ...bindings, ...childBindings }),
  };
}

export const rootLogger = createLogger();
