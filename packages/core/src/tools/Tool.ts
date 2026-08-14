import type { ZodType } from "zod";
import type { PermissionLevel } from "../types/permissions.js";
import type { Logger } from "../types/logger.js";

export interface ToolContext {
  conversationId: string;
  userId: string;
  workspaceDir: string;
  logger: Logger;
}

export interface ToolVerificationResult {
  ok: boolean;
  note?: string;
}

/**
 * Standard contract every capability implements — built-in, or from a
 * plugin. See PLUGIN_DEVELOPMENT.md.
 */
export interface Tool<I = unknown, O = unknown> {
  name: string;
  description: string;
  inputSchema: ZodType<I>;
  outputSchema: ZodType<O>;
  permission: PermissionLevel;
  execute(input: I, ctx: ToolContext): Promise<O>;
  verify?(input: I, output: O, ctx: ToolContext): Promise<ToolVerificationResult>;
}

/** A tool declared but not yet backed by a real implementation (see section 40: don't fake it). */
export class ToolNotImplementedError extends Error {
  constructor(toolName: string, requirement: string) {
    super(`${toolName} is not implemented yet. Required to finish it: ${requirement}`);
    this.name = "ToolNotImplementedError";
  }
}
