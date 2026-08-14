import { OpenAITTSProvider } from "./OpenAITTSProvider.js";
import { OpenAISTTProvider } from "./OpenAISTTProvider.js";
import type { STTProvider, TTSProvider } from "./types.js";
import { VoiceConfigError } from "./types.js";

export type VoiceProviderName = "none" | "openai";

export function createTTSProvider(provider: VoiceProviderName, apiKey?: string): TTSProvider {
  switch (provider) {
    case "openai":
      return new OpenAITTSProvider(apiKey ?? "");
    case "none":
    default:
      throw new VoiceConfigError(
        'TTS_PROVIDER is "none" — text-to-speech is not configured (see CONFIGURATION.md).',
      );
  }
}

export function createSTTProvider(provider: VoiceProviderName, apiKey?: string): STTProvider {
  switch (provider) {
    case "openai":
      return new OpenAISTTProvider(apiKey ?? "");
    case "none":
    default:
      throw new VoiceConfigError(
        'STT_PROVIDER is "none" — speech-to-text is not configured (see CONFIGURATION.md).',
      );
  }
}
