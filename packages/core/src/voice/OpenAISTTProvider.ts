import type { AudioAttachment, STTProvider, STTResult } from "./types.js";
import { VoiceConfigError } from "./types.js";

const DEFAULT_MODEL = "whisper-1";

function extensionForMimeType(mimeType: string): string {
  const subtype = mimeType.split("/")[1]?.split(";")[0] ?? "webm";
  return subtype === "mpeg" ? "mp3" : subtype;
}

/** Real HTTP client for OpenAI's Whisper transcription API — no mock/fake transcript. */
export class OpenAISTTProvider implements STTProvider {
  readonly name = "openai";

  constructor(
    private apiKey: string,
    private baseURL = "https://api.openai.com/v1",
  ) {
    if (!apiKey) {
      throw new VoiceConfigError(
        "STT_PROVIDER=openai requires VOICE_API_KEY to be set (see .env.example).",
      );
    }
  }

  async transcribe(audio: AudioAttachment): Promise<STTResult> {
    const bytes = Buffer.from(audio.base64, "base64");
    const form = new FormData();
    form.append("model", DEFAULT_MODEL);
    form.append(
      "file",
      new Blob([bytes], { type: audio.mimeType }),
      `audio.${extensionForMimeType(audio.mimeType)}`,
    );

    const res = await fetch(`${this.baseURL}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: form,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`OpenAI transcription request failed: ${res.status} ${res.statusText} ${body}`.trim());
    }

    const data = (await res.json()) as { text: string };
    return { text: data.text };
  }
}
