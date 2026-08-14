import { z } from "zod";
import type { JarvisPlugin, Tool } from "@jarvis/core";

/**
 * Reference plugin proving the loader mechanism end-to-end. See
 * PLUGIN_DEVELOPMENT.md for the walkthrough this package follows.
 */
const timeNowTool: Tool<{ timezone?: string }, { iso: string; formatted: string }> = {
  name: "time.now",
  description: "Get the current date and time, optionally in a specific IANA timezone.",
  inputSchema: z.object({ timezone: z.string().optional() }),
  outputSchema: z.object({ iso: z.string(), formatted: z.string() }),
  permission: "safe",
  async execute(input) {
    const now = new Date();
    const formatted = new Intl.DateTimeFormat("en-US", {
      dateStyle: "full",
      timeStyle: "long",
      timeZone: input.timezone,
    }).format(now);
    return { iso: now.toISOString(), formatted };
  },
};

const plugin: JarvisPlugin = {
  manifest: {
    name: "@jarvis/plugin-example",
    version: "0.1.0",
    description: "Reference plugin: adds time.now to prove the plugin loader works end-to-end.",
  },
  registerTools() {
    return [timeNowTool];
  },
};

export default plugin;
