import { z } from "zod";
import type { Tool } from "@jarvis/core";
import type { MemoryService } from "../../memory/memoryService.js";

const memoryTypeEnum = z.enum(["fact", "preference", "project", "task", "routine", "episodic"]);

export function createMemoryTools(memoryService: MemoryService): Tool[] {
  const remember: Tool<
    { content: string; type?: z.infer<typeof memoryTypeEnum>; tags?: string[] },
    { id: string; stored: boolean }
  > = {
    name: "memory.remember",
    description:
      "Durably remember an explicit fact, preference, project detail, or routine the user asked to be remembered.",
    inputSchema: z.object({
      content: z.string().min(3).max(2000),
      type: memoryTypeEnum.optional(),
      tags: z.array(z.string()).optional(),
    }),
    outputSchema: z.object({ id: z.string(), stored: z.boolean() }),
    permission: "safe",
    async execute(input) {
      const record = memoryService.remember({ ...input, source: "user_explicit" });
      return { id: record.id, stored: true };
    },
  };

  const recall: Tool<{ query?: string }, { memories: { id: string; content: string; type: string }[] }> = {
    name: "memory.recall",
    description: "Search confirmed long-term memory for relevant facts/preferences. Omit query to list recent memories.",
    inputSchema: z.object({ query: z.string().optional() }),
    outputSchema: z.object({
      memories: z.array(z.object({ id: z.string(), content: z.string(), type: z.string() })),
    }),
    permission: "safe",
    async execute(input) {
      const results = memoryService.recall(input.query);
      return { memories: results.map((m) => ({ id: m.id, content: m.content, type: m.type })) };
    },
  };

  const list: Tool<Record<string, never>, { memories: { id: string; content: string; type: string; status: string }[] }> = {
    name: "memory.list",
    description: "List every stored memory including proposed (unconfirmed) ones.",
    inputSchema: z.object({}),
    outputSchema: z.object({
      memories: z.array(
        z.object({ id: z.string(), content: z.string(), type: z.string(), status: z.string() }),
      ),
    }),
    permission: "safe",
    async execute() {
      const results = memoryService.list();
      return {
        memories: results.map((m) => ({ id: m.id, content: m.content, type: m.type, status: m.status })),
      };
    },
  };

  const forget: Tool<{ id?: string; query?: string }, { removed: number }> = {
    name: "memory.forget",
    description: "Delete a specific memory by id, or every memory matching a query string.",
    inputSchema: z
      .object({ id: z.string().optional(), query: z.string().optional() })
      .refine((v) => v.id || v.query, { message: "Provide either id or query." }),
    outputSchema: z.object({ removed: z.number() }),
    permission: "low",
    async execute(input) {
      if (input.id) {
        return { removed: memoryService.forget(input.id) ? 1 : 0 };
      }
      return { removed: memoryService.forgetMatching(input.query as string) };
    },
  };

  return [remember, recall, list, forget];
}
