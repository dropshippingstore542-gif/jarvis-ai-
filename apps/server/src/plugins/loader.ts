import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { ToolRegistry, JarvisPlugin, Logger } from "@jarvis/core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// apps/server/src (or dist)/plugins -> repo root /plugins
const DEFAULT_PLUGINS_DIR = path.resolve(__dirname, "../../../../plugins");

interface LoadedPluginModule {
  default?: JarvisPlugin;
}

/**
 * Discovers plugin packages under plugins/<name>/dist/index.js and
 * registers whatever tools they export. A plugin that fails to load or
 * isn't built yet is logged and skipped — it never crashes the server, and
 * it never silently pretends to be active. See PLUGIN_DEVELOPMENT.md.
 */
export async function loadPlugins(
  registry: ToolRegistry,
  logger: Logger,
  pluginsDir: string = DEFAULT_PLUGINS_DIR,
): Promise<void> {
  if (!fs.existsSync(pluginsDir)) return;

  const entries = fs.readdirSync(pluginsDir, { withFileTypes: true }).filter((e) => e.isDirectory());

  for (const entry of entries) {
    const entryPoint = path.join(pluginsDir, entry.name, "dist", "index.js");
    if (!fs.existsSync(entryPoint)) {
      logger.warn(`Plugin "${entry.name}" skipped: not built (expected ${entryPoint}). Run its build script.`);
      continue;
    }
    try {
      const mod = (await import(pathToFileURL(entryPoint).href)) as LoadedPluginModule;
      const plugin = mod.default;
      if (!plugin || !plugin.manifest || typeof plugin.registerTools !== "function") {
        logger.warn(`Plugin "${entry.name}" skipped: does not export a valid JarvisPlugin default export.`);
        continue;
      }
      const tools = await plugin.registerTools(registry, {
        logger: logger.child({ plugin: plugin.manifest.name }),
        config: process.env as Record<string, string | undefined>,
      });
      for (const tool of tools) {
        if (!registry.has(tool.name)) registry.register(tool);
      }
      logger.info(`Loaded plugin "${plugin.manifest.name}"@${plugin.manifest.version} (${tools.length} tool(s))`);
    } catch (err) {
      logger.error(`Plugin "${entry.name}" failed to load`, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
