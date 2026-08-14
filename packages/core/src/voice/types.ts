import type { ImageAttachment } from "../llm/types.js";

/** Real audio bytes — same shape as ImageAttachment, just audio instead of image. */
export type AudioAttachment = ImageAttachment;

export interface TTSResult {
  audio: AudioAttachment;
}

export interface TTSProvider {
  readonly name: string;
  synthesize(text: string, opts?: { voice?: string; speed?: number }): Promise<TTSResult>;
}

export interface STTResult {
  text: string;
}

export interface STTProvider {
  readonly name: string;
  transcribe(audio: AudioAttachment): Promise<STTResult>;
}

export class VoiceConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VoiceConfigError";
  }
}
