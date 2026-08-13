import { zodToJsonSchema } from "zod-to-json-schema";
import type { Tool } from "./Tool.js";
import type { ToolSpec } from "../llm/types.js";

export function toToolSpec(tool: Tool): ToolSpec {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: zodToJsonSchema(tool.inputSchema, { target: "openApi3" }) as Record<
      string,
      unknown
    >,
  };
}
