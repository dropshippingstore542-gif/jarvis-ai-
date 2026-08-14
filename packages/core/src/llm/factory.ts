import { AnthropicProvider } from "./AnthropicProvider.js";
import { OpenAIProvider } from "./OpenAIProvider.js";
import { LocalProvider } from "./LocalProvider.js";
import type { LLMProvider } from "./types.js";
import { LLMConfigError } from "./types.js";

export type AIProviderName = "anthropic" | "openai" | "local";

export interface LLMProviderConfig {
  provider: AIProviderName;
  apiKey?: string;
  baseURL?: string;
}

export function createLLMProvider(config: LLMProviderConfig): LLMProvider {
  switch (config.provider) {
    case "anthropic":
      return new AnthropicProvider({ apiKey: config.apiKey, baseURL: config.baseURL });
    case "openai":
      return new OpenAIProvider({ apiKey: config.apiKey, baseURL: config.baseURL });
    case "local":
      return new LocalProvider({ apiKey: config.apiKey, baseURL: config.baseURL });
    default:
      throw new LLMConfigError(
        `Unknown AI_PROVIDER "${config.provider as string}". Expected anthropic | openai | local.`,
      );
  }
}
