import { afterAll, describe, expect, it } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { rootLogger } from "../../logger.js";
import { BrowserManager } from "../../browser/browserManager.js";
import { createBrowserTools } from "./browserTools.js";
import type { ToolContext } from "@jarvis/core";

const PAGE_HTML = `<!doctype html>
<html><head><title>Test Page</title></head><body>
  <h1>Test Page</h1>
  <a href="/second">Go to second page</a>
  <form>
    <input id="q" name="q" />
    <button id="go" type="button" onclick="document.getElementById('result').innerText='searched: ' + document.getElementById('q').value">Go</button>
  </form>
  <div id="result"></div>
</body></html>`;

const SECOND_PAGE_HTML = `<!doctype html><html><body><h1>Second Page</h1></body></html>`;

function startServer(): Promise<{ url: string; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      res.setHeader("Content-Type", "text/html");
      if (req.url === "/second") {
        res.end(SECOND_PAGE_HTML);
      } else {
        res.end(PAGE_HTML);
      }
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

describe("browser tools (real Chromium, no network required)", () => {
  const manager = new BrowserManager(rootLogger.child({ test: "browserTools" }));
  // The test server binds to 127.0.0.1 (loopback), which the SSRF guard blocks by default —
  // bypass it here since this is a same-process test fixture, not a real external target.
  const { open, click, type } = createBrowserTools(manager, { allowPrivateNetworks: true });

  const ctx: ToolContext = {
    conversationId: "browser-test",
    userId: "u1",
    workspaceDir: "/tmp",
    logger: rootLogger.child({ test: "browserTools" }),
  };

  afterAll(async () => {
    await manager.shutdown();
  });

  it("opens a page and extracts title/text/links", async () => {
    const server = await startServer();
    try {
      const result = await open.execute({ url: server.url }, ctx);
      expect(result.title).toBe("Test Page");
      expect(result.text).toContain("Test Page");
      expect(result.links.some((l) => l.href === `${server.url}/second`)).toBe(true);
    } finally {
      await server.close();
    }
  });

  it("refuses non-http(s) URLs", async () => {
    await expect(open.execute({ url: "file:///etc/passwd" }, ctx)).rejects.toThrow(/only http\/https/);
  });

  it("requires browser.open before click/type", async () => {
    const freshCtx = { ...ctx, conversationId: "browser-test-fresh" };
    await expect(click.execute({ selector: "#go" }, freshCtx)).rejects.toThrow(/call browser\.open first/i);
  });

  it("types into a field and clicks a button on the same page", async () => {
    const server = await startServer();
    try {
      await open.execute({ url: server.url }, ctx);
      await type.execute({ selector: "#q", text: "hello" }, ctx);
      const result = await click.execute({ selector: "#go" }, ctx);
      expect(result.text).toContain("searched: hello");
    } finally {
      await server.close();
    }
  });
});
