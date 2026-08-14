import { describe, expect, it } from "vitest";
import type { EmailProvider, ToolContext } from "@jarvis/core";
import { createEmailTools } from "./emailTools.js";
import { rootLogger } from "../../logger.js";

const ctx: ToolContext = {
  conversationId: "c1",
  userId: "u1",
  workspaceDir: "/tmp",
  logger: rootLogger,
};

describe("email.send", () => {
  it("is registered as high permission — the spec's own HIGH RISK example", () => {
    const { send } = createEmailTools(undefined);
    expect(send.permission).toBe("high");
  });

  it("reports a clear error instead of pretending to send when unconfigured", async () => {
    const { send } = createEmailTools(undefined);
    await expect(
      send.execute({ to: ["a@example.com"], subject: "Hi", body: "Hello" }, ctx),
    ).rejects.toThrow(/not configured/i);
  });

  it("delegates to the real provider and returns its message id when configured", async () => {
    const sent: unknown[] = [];
    const fakeProvider: EmailProvider = {
      name: "fake",
      async send(message) {
        sent.push(message);
        return { messageId: "msg-1" };
      },
    };
    const { send } = createEmailTools(fakeProvider);
    const result = await send.execute({ to: ["a@example.com"], subject: "Hi", body: "Hello" }, ctx);
    expect(result.messageId).toBe("msg-1");
    expect(sent).toHaveLength(1);
  });
});
