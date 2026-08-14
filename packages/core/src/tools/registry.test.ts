import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ToolRegistry } from "./registry.js";
import type { Tool } from "./Tool.js";

function makeTool(name: string): Tool {
  return {
    name,
    description: "test tool",
    inputSchema: z.object({}),
    outputSchema: z.object({}),
    permission: "safe",
    async execute() {
      return {};
    },
  };
}

describe("ToolRegistry", () => {
  it("registers and retrieves tools", () => {
    const registry = new ToolRegistry();
    registry.register(makeTool("test.one"));
    expect(registry.has("test.one")).toBe(true);
    expect(registry.get("test.one")?.name).toBe("test.one");
    expect(registry.list()).toHaveLength(1);
  });

  it("rejects duplicate registration", () => {
    const registry = new ToolRegistry();
    registry.register(makeTool("test.one"));
    expect(() => registry.register(makeTool("test.one"))).toThrow(/already registered/);
  });

  it("returns undefined for unknown tools", () => {
    const registry = new ToolRegistry();
    expect(registry.get("nope")).toBeUndefined();
  });
});
