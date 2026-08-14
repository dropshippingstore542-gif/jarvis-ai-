import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  ToolRegistry,
  type ChatParams,
  type ChatStreamEvent,
  type LLMProvider,
  type Tool,
} from "@jarvis/core";
import { openDatabase } from "../db/client.js";
import { createRepositories } from "../db/repositories/index.js";
import { MemoryService } from "../memory/memoryService.js";
import { PermissionEngine } from "../permissions/permissionEngine.js";
import { AuditService } from "../audit/auditService.js";
import { Orchestrator } from "./orchestrator.js";
import { rootLogger } from "../logger.js";

function scriptedLLM(scripts: ChatStreamEvent[][]) {
  let i = 0;
  const calls: ChatParams[] = [];
  const provider: LLMProvider = {
    name: "scripted",
    async *chat(params: ChatParams) {
      calls.push(params);
      const script = scripts[i++] ?? [];
      for (const event of script) yield event;
    },
  };
  return { provider, calls };
}

describe("Orchestrator vision wiring", () => {
  it("attaches a tool's image output to the tool message so the model genuinely sees it next turn", async () => {
    const db = openDatabase(":memory:");
    const repos = createRepositories(db);
    const memoryService = new MemoryService(repos.memories);
    const toolRegistry = new ToolRegistry();

    const visionTool: Tool<
      Record<string, never>,
      { note: string; image: { mimeType: string; base64: string } }
    > = {
      name: "vision.test",
      description: "test tool that returns a real image",
      inputSchema: z.object({}),
      outputSchema: z.object({
        note: z.string(),
        image: z.object({ mimeType: z.string(), base64: z.string() }),
      }),
      permission: "safe",
      async execute() {
        return { note: "ok", image: { mimeType: "image/png", base64: "AAAA" } };
      },
    };
    toolRegistry.register(visionTool);

    const permissionEngine = new PermissionEngine(repos.pendingActions, () => {});
    const auditService = new AuditService(repos.auditLog);

    const { provider: llm, calls } = scriptedLLM([
      [
        { type: "tool_call", call: { id: "call_1", name: "vision.test", input: {} } },
        { type: "message_stop", stopReason: "tool_use" },
      ],
      [
        { type: "text_delta", text: "I see a red square." },
        { type: "message_stop", stopReason: "end_turn" },
      ],
    ]);

    const orchestrator = new Orchestrator(
      llm,
      "test-model",
      toolRegistry,
      permissionEngine,
      auditService,
      memoryService,
      repos.conversations,
      repos.messages,
      "JARVIS",
    );

    const events = [];
    for await (const event of orchestrator.handleUserMessage({
      conversationId: "conv1",
      userId: "u1",
      workspaceDir: "/tmp",
      text: "look at this",
      logger: rootLogger,
    })) {
      events.push(event);
    }

    expect(
      events.some((e) => e.type === "message_complete" && e.content === "I see a red square."),
    ).toBe(true);

    // The second LLM call's message history must carry the image forward.
    expect(calls).toHaveLength(2);
    const secondCallMessages = calls[1]?.messages ?? [];
    const toolMsg = secondCallMessages.find((m) => m.role === "tool");
    expect(toolMsg?.images).toEqual([{ mimeType: "image/png", base64: "AAAA" }]);
    // The raw bytes aren't duplicated into the text content.
    expect(toolMsg?.content).not.toContain("AAAA");

    // And it's persisted, so a later message in this conversation still has it available.
    const stored = repos.messages.listByConversation("conv1");
    const storedToolMsg = stored.find((m) => m.role === "tool");
    expect(storedToolMsg?.images).toEqual([{ mimeType: "image/png", base64: "AAAA" }]);
  });
});
