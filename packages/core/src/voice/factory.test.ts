import { describe, expect, it } from "vitest";
import { createSTTProvider, createTTSProvider } from "./factory.js";
import { VoiceConfigError } from "./types.js";

describe("voice provider factories", () => {
  it("throws a clear config error for tts provider 'none'", () => {
    expect(() => createTTSProvider("none")).toThrow(VoiceConfigError);
  });

  it("throws a clear config error for stt provider 'none'", () => {
    expect(() => createSTTProvider("none")).toThrow(VoiceConfigError);
  });

  it("throws a clear config error for openai without an api key", () => {
    expect(() => createTTSProvider("openai")).toThrow(VoiceConfigError);
    expect(() => createSTTProvider("openai")).toThrow(VoiceConfigError);
  });

  it("constructs a real provider given an api key", () => {
    expect(createTTSProvider("openai", "sk-test").name).toBe("openai");
    expect(createSTTProvider("openai", "sk-test").name).toBe("openai");
  });
});
