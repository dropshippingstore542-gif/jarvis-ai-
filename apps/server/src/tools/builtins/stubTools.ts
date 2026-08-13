import { z } from "zod";
import type { Tool } from "@jarvis/core";
import { ToolNotImplementedError } from "@jarvis/core";

/**
 * These tools are registered so the orchestrator's tool-selection and
 * permission machinery can be exercised end-to-end, and so the LLM can see
 * (and gracefully decline to rely on) capabilities that don't exist yet.
 * Calling one always fails clearly — see ARCHITECTURE.md "Out of scope this
 * pass" for exactly what each needs to become real.
 */
function stub(
  name: string,
  description: string,
  permission: Tool["permission"],
  requirement: string,
): Tool {
  return {
    name,
    description: `${description} (NOT YET IMPLEMENTED — see PLUGIN_DEVELOPMENT.md/ARCHITECTURE.md)`,
    inputSchema: z.record(z.unknown()),
    outputSchema: z.unknown(),
    permission,
    async execute() {
      throw new ToolNotImplementedError(name, requirement);
    },
  };
}

export function createStubTools(): Tool[] {
  return [
    stub(
      "browser.open",
      "Open a URL in a controlled browser and read its content",
      "low",
      "a browser automation module (Playwright) wired to a sandboxed browser context",
    ),
    stub(
      "browser.click",
      "Click an element on the currently open page",
      "medium",
      "the browser automation module plus DOM/accessibility-tree element resolution",
    ),
    stub(
      "computer.take_screenshot",
      "Capture the current screen for the vision subsystem",
      "low",
      "OS-level screen capture access, unavailable in this server-only environment",
    ),
    stub(
      "computer.open_app",
      "Launch a local application",
      "medium",
      "a companion desktop process (planned: Tauri shell) with OS process-launch permission",
    ),
    stub(
      "calendar.create_event",
      "Create a calendar event",
      "medium",
      "a Google Calendar/Outlook integration with OAuth credentials configured",
    ),
    stub(
      "email.send",
      "Send an email",
      "high",
      "a Gmail/SMTP integration with OAuth or app-password credentials configured",
    ),
  ];
}
