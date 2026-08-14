import { describe, expect, it } from "vitest";
import { createLLMProvider } from "./factory.js";
import { LLMConfigError } from "./types.js";

describe("createLLMProvider", () => {
  it("throws a clear config error for anthropic without an API key", () => {
    expect(() => createLLMProvider({ provider: "anthropic" })).toThrow(LLMConfigError);
  });

  it("throws a clear config error for openai without an API key", () => {
    expect(() => createLLMProvider({ provider: "openai" })).toThrow(LLMConfigError);
  });

  it("throws a clear config error for local without a base URL", () => {
    expect(() => createLLMProvider({ provider: "local" })).toThrow(LLMConfigError);
  });

  it("throws for an unknown provider name", () => {
    // @ts-expect-error deliberately invalid
    expect(() => createLLMProvider({ provider: "not-a-provider" })).toThrow(LLMConfigError);
  });

  it("constructs an anthropic provider given an API key", () => {
    const provider = createLLMProvider({ provider: "anthropic", apiKey: "sk-test" });
    expect(provider.name).toBe("anthropic");
  });

  it("constructs a local provider given a base URL", () => {
    const provider = createLLMProvider({ provider: "local", baseURL: "http://localhost:11434/v1" });
    expect(provider.name).toBe("local");
  });
});
