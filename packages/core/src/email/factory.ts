import { SmtpEmailProvider, type SmtpConfig } from "./SmtpEmailProvider.js";
import type { EmailProvider } from "./types.js";
import { EmailConfigError } from "./types.js";

export type EmailProviderName = "none" | "smtp";

export function createEmailProvider(
  provider: EmailProviderName,
  smtpConfig?: Partial<SmtpConfig>,
): EmailProvider {
  if (provider === "smtp") {
    return new SmtpEmailProvider({
      host: smtpConfig?.host ?? "",
      port: smtpConfig?.port ?? 587,
      secure: smtpConfig?.secure ?? false,
      user: smtpConfig?.user ?? "",
      pass: smtpConfig?.pass ?? "",
      from: smtpConfig?.from ?? "",
    });
  }
  throw new EmailConfigError(
    'EMAIL_PROVIDER is "none" — email sending is not configured (see CONFIGURATION.md).',
  );
}
