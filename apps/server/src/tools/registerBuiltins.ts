import { ToolRegistry } from "@jarvis/core";
import type { MemoryService } from "../memory/memoryService.js";
import type { config } from "../config.js";
import { createMemoryTools } from "./builtins/memoryTools.js";
import { createFilesystemTools } from "./builtins/filesystemTools.js";
import { createWebSearchTools } from "./builtins/webSearchTools.js";
import { createStubTools } from "./builtins/stubTools.js";

export function registerBuiltinTools(
  registry: ToolRegistry,
  deps: { memoryService: MemoryService; webSearchConfig: (typeof config)["webSearch"] },
): void {
  const filesystemTools = createFilesystemTools();
  for (const tool of [
    ...createMemoryTools(deps.memoryService),
    filesystemTools.read,
    filesystemTools.write,
    filesystemTools.list,
    ...createWebSearchTools(deps.webSearchConfig),
    ...createStubTools(),
  ]) {
    registry.register(tool);
  }
}
