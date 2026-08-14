import type { Tool } from "./Tool.js";

/**
 * Holds every tool available to the brain — built-in and plugin-provided
 * alike. Registration is the plugin system's integration point (see
 * PLUGIN_DEVELOPMENT.md): a plugin calls `registry.register(tool)` for each
 * capability it adds, and the brain never needs to know where a tool came
 * from.
 */
export class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered.`);
    }
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  list(): Tool[] {
    return [...this.tools.values()];
  }
}
