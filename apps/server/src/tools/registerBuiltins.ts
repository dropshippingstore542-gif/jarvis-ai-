import { ToolRegistry } from "@jarvis/core";
import type { MemoryService } from "../memory/memoryService.js";
import type { config } from "../config.js";
import type { BrowserManager } from "../browser/browserManager.js";
import { createMemoryTools } from "./builtins/memoryTools.js";
import { createFilesystemTools } from "./builtins/filesystemTools.js";
import { createWebSearchTools } from "./builtins/webSearchTools.js";
import { createBrowserTools } from "./builtins/browserTools.js";
import { createVisionTools } from "./builtins/visionTools.js";
import { createStubTools } from "./builtins/stubTools.js";

export function registerBuiltinTools(
  registry: ToolRegistry,
  deps: {
    memoryService: MemoryService;
    webSearchConfig: (typeof config)["webSearch"];
    browserManager: BrowserManager;
    browserConfig: (typeof config)["browser"];
  },
): void {
  const filesystemTools = createFilesystemTools();
  const browserTools = createBrowserTools(deps.browserManager, deps.browserConfig);
  const visionTools = createVisionTools();
  for (const tool of [
    ...createMemoryTools(deps.memoryService),
    filesystemTools.read,
    filesystemTools.write,
    filesystemTools.list,
    filesystemTools.mkdir,
    filesystemTools.move,
    filesystemTools.delete,
    ...createWebSearchTools(deps.webSearchConfig),
    browserTools.open,
    browserTools.click,
    browserTools.type,
    browserTools.screenshot,
    visionTools.describeImage,
    ...createStubTools(),
  ]) {
    registry.register(tool);
  }
}
