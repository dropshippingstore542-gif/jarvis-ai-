import { describe, expect, it } from "vitest";
import { createEmailProvider } from "./factory.js";
import { EmailConfigError } from "./types.js";

describe("createEmailProvider", () => {
  it("throws a clear config error for provider 'none'", () => {
    expect(() => createEmailProvider("none")).toThrow(EmailConfigError);
  });

  it("throws a clear config error for smtp without required settings", () => {
    expect(() => createEmailProvider("smtp")).toThrow(EmailConfigError);
  });

  it("constructs a real provider given full smtp settings", () => {
    const provider = createEmailProvider("smtp", {
      host: "smtp.example.com",
      port: 587,
      secure: false,
      user: "me@example.com",
      pass: "app-password",
      from: "me@example.com",
    });
    expect(provider.name).toBe("smtp");
  });
});
