import nodemailer from "nodemailer";
import type { EmailMessage, EmailProvider, EmailResult } from "./types.js";
import { EmailConfigError } from "./types.js";

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

/** Real SMTP client (nodemailer) — works with Gmail/Outlook app passwords or any SMTP server. */
export class SmtpEmailProvider implements EmailProvider {
  readonly name = "smtp";
  private transporter: nodemailer.Transporter;

  constructor(private config: SmtpConfig) {
    if (!config.host || !config.user || !config.pass || !config.from) {
      throw new EmailConfigError(
        "EMAIL_PROVIDER=smtp requires SMTP_HOST, SMTP_USER, SMTP_PASS, and EMAIL_FROM (see .env.example).",
      );
    }
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.pass },
    });
  }

  async send(message: EmailMessage): Promise<EmailResult> {
    const info = await this.transporter.sendMail({
      from: this.config.from,
      to: message.to.join(", "),
      cc: message.cc?.join(", "),
      bcc: message.bcc?.join(", "),
      subject: message.subject,
      text: message.body,
    });
    return { messageId: info.messageId };
  }
}
