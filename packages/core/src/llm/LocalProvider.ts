import { OpenAIProvider } from "./OpenAIProvider.js";
import { LLMConfigError } from "./types.js";

/**
 * Talks to any OpenAI-compatible local inference server (Ollama's `/v1`
 * endpoint, LM Studio, vLLM, etc.) so Jarvis can run fully offline. This is
 * a real client, not a mock — if AI_BASE_URL is unset or unreachable it
 * fails loudly rather than fabricating a response.
 */
export class LocalProvider extends OpenAIProvider {
  constructor(opts: { baseURL?: string; apiKey?: string }) {
    if (!opts.baseURL) {
      throw new LLMConfigError(
        "AI_PROVIDER=local requires AI_BASE_URL to point at an OpenAI-compatible " +
          "endpoint, e.g. http://localhost:11434/v1 for Ollama.",
      );
    }
    super({ apiKey: opts.apiKey ?? "local", baseURL: opts.baseURL, providerName: "local" });
  }
}
