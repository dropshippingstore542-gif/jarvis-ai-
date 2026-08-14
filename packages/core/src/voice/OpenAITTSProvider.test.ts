import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAITTSProvider } from "./OpenAITTSProvider.js";

describe("OpenAITTSProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts the expected request and returns real audio bytes as base64", async () => {
    const audioBytes = new Uint8Array([1, 2, 3, 4]);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => audioBytes.buffer,
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAITTSProvider("sk-test");
    const result = await provider.synthesize("hello world", { voice: "nova" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/audio/speech");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-test");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ input: "hello world", voice: "nova", response_format: "mp3" });

    expect(result.audio.mimeType).toBe("audio/mpeg");
    expect(Buffer.from(result.audio.base64, "base64")).toEqual(Buffer.from(audioBytes));
  });

  it("throws a descriptive error on a non-ok response instead of returning fake audio", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401, statusText: "Unauthorized", text: async () => "bad key" }),
    );
    const provider = new OpenAITTSProvider("sk-bad");
    await expect(provider.synthesize("hi")).rejects.toThrow(/401/);
  });
});
