import type { TTSProvider, TTSResult } from "./types.js";
import { VoiceConfigError } from "./types.js";

const DEFAULT_VOICE = "alloy";
const DEFAULT_MODEL = "tts-1";

/** Real HTTP client for OpenAI's text-to-speech API — no mock/fake audio. */
export class OpenAITTSProvider implements TTSProvider {
  readonly name = "openai";

  constructor(
    private apiKey: string,
    private baseURL = "https://api.openai.com/v1",
  ) {
    if (!apiKey) {
      throw new VoiceConfigError(
        "TTS_PROVIDER=openai requires VOICE_API_KEY to be set (see .env.example).",
      );
    }
  }

  async synthesize(text: string, opts?: { voice?: string; speed?: number }): Promise<TTSResult> {
    const res = await fetch(`${this.baseURL}/audio/speech`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        voice: opts?.voice ?? DEFAULT_VOICE,
        input: text,
        speed: opts?.speed,
        response_format: "mp3",
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`OpenAI TTS request failed: ${res.status} ${res.statusText} ${body}`.trim());
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    return { audio: { mimeType: "audio/mpeg", base64: buffer.toString("base64") } };
  }
}
