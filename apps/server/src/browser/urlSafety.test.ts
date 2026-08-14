import { describe, expect, it } from "vitest";
import { assertSafeHttpUrl, UnsafeUrlError } from "./urlSafety.js";

describe("assertSafeHttpUrl", () => {
  it("rejects non-http(s) protocols", async () => {
    await expect(assertSafeHttpUrl("file:///etc/passwd")).rejects.toThrow(UnsafeUrlError);
    await expect(assertSafeHttpUrl("javascript:alert(1)")).rejects.toThrow(UnsafeUrlError);
  });

  it("rejects loopback and localhost", async () => {
    await expect(assertSafeHttpUrl("http://127.0.0.1/")).rejects.toThrow(UnsafeUrlError);
    await expect(assertSafeHttpUrl("http://localhost:8080/")).rejects.toThrow(UnsafeUrlError);
    await expect(assertSafeHttpUrl("http://[::1]/")).rejects.toThrow(UnsafeUrlError);
  });

  it("rejects private and link-local IP ranges, including the cloud metadata address", async () => {
    await expect(assertSafeHttpUrl("http://10.0.0.5/")).rejects.toThrow(UnsafeUrlError);
    await expect(assertSafeHttpUrl("http://172.16.5.1/")).rejects.toThrow(UnsafeUrlError);
    await expect(assertSafeHttpUrl("http://192.168.1.1/")).rejects.toThrow(UnsafeUrlError);
    await expect(assertSafeHttpUrl("http://169.254.169.254/")).rejects.toThrow(UnsafeUrlError);
  });

  it("allows a public IP literal (no DNS dependency, so this stays deterministic offline)", async () => {
    await expect(assertSafeHttpUrl("http://93.184.216.34/")).resolves.toBeInstanceOf(URL);
    await expect(assertSafeHttpUrl("https://8.8.8.8/path")).resolves.toBeInstanceOf(URL);
  });

  it("bypasses the guard when allowPrivateNetworks is set", async () => {
    await expect(
      assertSafeHttpUrl("http://127.0.0.1:9999/", { allowPrivateNetworks: true }),
    ).resolves.toBeInstanceOf(URL);
  });
});
