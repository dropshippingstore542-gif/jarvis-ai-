import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAISTTProvider } from "./OpenAISTTProvider.js";

describe("OpenAISTTProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts a multipart form with the audio and returns the real transcript", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: "hello from the microphone" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAISTTProvider("sk-test");
    const result = await provider.transcribe({ mimeType: "audio/webm", base64: Buffer.from("fake-audio").toString("base64") });

    expect(result.text).toBe("hello from the microphone");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/audio/transcriptions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-test");
    expect(init.body).toBeInstanceOf(FormData);
    const form = init.body as FormData;
    expect(form.get("model")).toBe("whisper-1");
    const file = form.get("file") as File;
    expect(file.name).toBe("audio.webm");
  });

  it("throws a descriptive error on a non-ok response instead of returning a fake transcript", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 400, statusText: "Bad Request", text: async () => "bad audio" }),
    );
    const provider = new OpenAISTTProvider("sk-test");
    await expect(provider.transcribe({ mimeType: "audio/webm", base64: "AAAA" })).rejects.toThrow(/400/);
  });
});
