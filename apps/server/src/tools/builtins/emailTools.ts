import { z } from "zod";
import type { EmailProvider, Tool } from "@jarvis/core";

export interface EmailTools {
  send: Tool<{ to: string[]; subject: string; body: string; cc?: string[] }, { messageId: string }>;
}

/**
 * The single highest-risk, most-real-world-visible action in the whole
 * system: it leaves the machine and lands in someone else's inbox,
 * irreversibly. `permission: "high"` is not a formality here — see
 * SECURITY.md.
 */
export function createEmailTools(emailProvider: EmailProvider | undefined): EmailTools {
  const send: Tool<{ to: string[]; subject: string; body: string; cc?: string[] }, { messageId: string }> = {
    name: "email.send",
    description: "Send a real email. Irreversible and visible to the recipient — requires explicit approval.",
    inputSchema: z.object({
      to: z.array(z.string().email()).min(1),
      subject: z.string().min(1),
      body: z.string().min(1),
      cc: z.array(z.string().email()).optional(),
    }),
    outputSchema: z.object({ messageId: z.string() }),
    permission: "high",
    async execute(input) {
      if (!emailProvider) {
        throw new Error("Email is not configured. Set EMAIL_PROVIDER=smtp and SMTP_* in .env.");
      }
      return emailProvider.send(input);
    },
  };

  return { send };
}
