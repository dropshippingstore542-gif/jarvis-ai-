import type { Tool } from "../tools/Tool.js";
import type { ToolRegistry } from "../tools/registry.js";
import type { Logger } from "./logger.js";

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
}

export interface PluginContext {
  logger: Logger;
  config: Record<string, string | undefined>;
}

/**
 * A plugin's entrypoint module must default-export an object matching this
 * shape. See PLUGIN_DEVELOPMENT.md for the full walkthrough.
 */
export interface JarvisPlugin {
  manifest: PluginManifest;
  registerTools(registry: ToolRegistry, ctx: PluginContext): Tool[] | Promise<Tool[]>;
}
