import { describe, expect, it } from "vitest";
import { z } from "zod";
import { toToolSpec } from "./toToolSpec.js";
import type { Tool } from "./Tool.js";

describe("toToolSpec", () => {
  it("converts a zod input schema into a JSON-schema-shaped ToolSpec", () => {
    const tool: Tool<{ query: string }, { ok: boolean }> = {
      name: "example.search",
      description: "search for something",
      inputSchema: z.object({ query: z.string() }),
      outputSchema: z.object({ ok: z.boolean() }),
      permission: "safe",
      async execute() {
        return { ok: true };
      },
    };

    const spec = toToolSpec(tool);
    expect(spec.name).toBe("example.search");
    expect(spec.description).toBe("search for something");
    expect(spec.inputSchema).toMatchObject({
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    });
  });
});
