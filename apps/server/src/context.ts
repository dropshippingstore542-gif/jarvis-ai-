import { createLLMProvider, ToolRegistry } from "@jarvis/core";
import type { Logger } from "@jarvis/core";
import { config } from "./config.js";
import { openDatabase } from "./db/client.js";
import { createRepositories, type Repositories } from "./db/repositories/index.js";
import { MemoryService } from "./memory/memoryService.js";
import { registerBuiltinTools } from "./tools/registerBuiltins.js";
import { PermissionEngine, type PermissionEvent } from "./permissions/permissionEngine.js";
import { AuditService } from "./audit/auditService.js";
import { Orchestrator } from "./brain/orchestrator.js";
import { WsHub } from "./ws/wsHub.js";
import { loadPlugins } from "./plugins/loader.js";
import { BrowserManager } from "./browser/browserManager.js";
import { Scheduler } from "./automation/scheduler.js";

export interface AppContext {
  repos: Repositories;
  memoryService: MemoryService;
  toolRegistry: ToolRegistry;
  permissionEngine: PermissionEngine;
  auditService: AuditService;
  orchestrator: Orchestrator;
  wsHub: WsHub;
  logger: Logger;
  browserManager: BrowserManager;
  scheduler: Scheduler;
}

export async function createAppContext(logger: Logger): Promise<AppContext> {
  const db = openDatabase();
  const repos = createRepositories(db);
  const memoryService = new MemoryService(repos.memories);
  const toolRegistry = new ToolRegistry();
  const wsHub = new WsHub();
  const browserManager = new BrowserManager(logger.child({ module: "browser" }));

  registerBuiltinTools(toolRegistry, {
    memoryService,
    webSearchConfig: config.webSearch,
    browserManager,
    browserConfig: config.browser,
  });
  await loadPlugins(toolRegistry, logger);

  const auditService = new AuditService(repos.auditLog);

  const permissionEngine = new PermissionEngine(repos.pendingActions, (event: PermissionEvent) => {
    wsHub.broadcast(event.action.conversationId, { type: event.type, action: event.action });
  });

  let llm;
  try {
    llm = createLLMProvider({
      provider: config.ai.provider,
      apiKey: config.ai.apiKey,
      baseURL: config.ai.baseURL,
    });
  } catch (err) {
    logger.warn(
      "LLM provider failed to initialize — chat will report a config error until fixed",
      { error: err instanceof Error ? err.message : String(err) },
    );
    llm = {
      name: "unconfigured",
      async *chat() {
        yield {
          type: "error" as const,
          message:
            err instanceof Error
              ? err.message
              : "AI provider is not configured. Check AI_PROVIDER/AI_API_KEY in .env.",
        };
      },
    };
  }

  const orchestrator = new Orchestrator(
    llm,
    config.ai.model,
    toolRegistry,
    permissionEngine,
    auditService,
    memoryService,
    repos.conversations,
    repos.messages,
    config.voice.wakeWord,
  );

  const scheduler = new Scheduler(
    repos.automations,
    repos.automationRuns,
    repos.conversations,
    orchestrator,
    config.workspaceDir,
    logger.child({ module: "scheduler" }),
  );

  return {
    repos,
    memoryService,
    toolRegistry,
    permissionEngine,
    auditService,
    orchestrator,
    wsHub,
    logger,
    browserManager,
    scheduler,
  };
}
