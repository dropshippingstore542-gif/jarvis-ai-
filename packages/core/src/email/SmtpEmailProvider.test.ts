import { describe, expect, it, vi, beforeEach } from "vitest";

const sendMail = vi.fn();
const createTransport = vi.fn((_config: unknown) => ({ sendMail }));

vi.mock("nodemailer", () => ({
  default: { createTransport: (config: unknown) => createTransport(config) },
}));

const { SmtpEmailProvider } = await import("./SmtpEmailProvider.js");
const { EmailConfigError } = await import("./types.js");

describe("SmtpEmailProvider", () => {
  beforeEach(() => {
    sendMail.mockReset();
    createTransport.mockClear();
  });

  it("throws a clear config error when required SMTP settings are missing", () => {
    expect(
      () => new SmtpEmailProvider({ host: "", port: 587, secure: false, user: "", pass: "", from: "" }),
    ).toThrow(EmailConfigError);
  });

  it("configures the transport with the given SMTP settings", () => {
    new SmtpEmailProvider({
      host: "smtp.example.com",
      port: 587,
      secure: false,
      user: "me@example.com",
      pass: "app-password",
      from: "Jarvis <me@example.com>",
    });
    expect(createTransport).toHaveBeenCalledWith({
      host: "smtp.example.com",
      port: 587,
      secure: false,
      auth: { user: "me@example.com", pass: "app-password" },
    });
  });

  it("sends a real message via the transport and returns its message id", async () => {
    sendMail.mockResolvedValue({ messageId: "<abc123@example.com>" });
    const provider = new SmtpEmailProvider({
      host: "smtp.example.com",
      port: 587,
      secure: false,
      user: "me@example.com",
      pass: "app-password",
      from: "Jarvis <me@example.com>",
    });

    const result = await provider.send({
      to: ["a@example.com", "b@example.com"],
      cc: ["c@example.com"],
      subject: "Hello",
      body: "Hi there",
    });

    expect(result.messageId).toBe("<abc123@example.com>");
    expect(sendMail).toHaveBeenCalledWith({
      from: "Jarvis <me@example.com>",
      to: "a@example.com, b@example.com",
      cc: "c@example.com",
      bcc: undefined,
      subject: "Hello",
      text: "Hi there",
    });
  });
});
