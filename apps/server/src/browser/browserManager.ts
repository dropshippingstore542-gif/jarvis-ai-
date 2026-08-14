import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import type { Logger } from "@jarvis/core";

const CHROMIUM_EXECUTABLE = process.env.PLAYWRIGHT_CHROMIUM_PATH || "/opt/pw-browsers/chromium";
const IDLE_TIMEOUT_MS = 10 * 60 * 1000;

// Chromium doesn't inherit the process's HTTPS_PROXY automatically — pass it through
// explicitly so browser.* tools work in proxied environments (corporate networks,
// this sandbox), not just on an unrestricted local machine. Loopback/localhost is
// always bypassed regardless of NO_PROXY so nothing (including this project's own
// test fixtures, which spin up a local http server) is silently routed through the
// proxy — that both breaks local-only traffic and would defeat the point of an
// SSRF guard that then hands blocked-looking traffic to an external proxy anyway.
function resolveProxyServer(): string | undefined {
  return (
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy ||
    undefined
  );
}

function resolveProxyBypass(): string {
  const fromEnv = process.env.NO_PROXY || process.env.no_proxy || "";
  const always = ["localhost", "127.0.0.1", "::1"];
  const extra = fromEnv
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
  return [...new Set([...always, ...extra])].join(",");
}

interface Session {
  context: BrowserContext;
  page: Page;
  lastUsed: number;
}

/**
 * One headless Chromium process shared across the server, with one isolated
 * context+page per conversation so sequential browser.open/click/type calls
 * within the same conversation act on the same page — the model reads and
 * manipulates the DOM/accessibility tree via Playwright, not screen
 * coordinates (spec: prefer DOM info, screen-coordinate control is an
 * unbuilt fallback). Idle sessions close after 10 minutes to bound
 * resource use in a long-running server process.
 */
export class BrowserManager {
  private browser: Browser | null = null;
  private sessions = new Map<string, Session>();
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor(private logger: Logger) {
    this.cleanupTimer = setInterval(() => void this.reapIdleSessions(), 60_000);
    this.cleanupTimer.unref?.();
  }

  private async ensureBrowser(): Promise<Browser> {
    if (this.browser?.isConnected()) return this.browser;
    const proxyServer = resolveProxyServer();
    this.browser = await chromium.launch({
      executablePath: CHROMIUM_EXECUTABLE,
      headless: true,
      proxy: proxyServer ? { server: proxyServer, bypass: resolveProxyBypass() } : undefined,
    });
    return this.browser;
  }

  async getOrCreatePage(conversationId: string): Promise<Page> {
    const existing = this.sessions.get(conversationId);
    if (existing && !existing.page.isClosed()) {
      existing.lastUsed = Date.now();
      return existing.page;
    }
    const browser = await this.ensureBrowser();
    const context = await browser.newContext();
    const page = await context.newPage();
    this.sessions.set(conversationId, { context, page, lastUsed: Date.now() });
    return page;
  }

  requirePage(conversationId: string): Page {
    const existing = this.sessions.get(conversationId);
    if (!existing || existing.page.isClosed()) {
      throw new Error("No page is open for this conversation yet — call browser.open first.");
    }
    existing.lastUsed = Date.now();
    return existing.page;
  }

  private async reapIdleSessions(): Promise<void> {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now - session.lastUsed > IDLE_TIMEOUT_MS) {
        await session.context.close().catch(() => {});
        this.sessions.delete(id);
        this.logger.debug("Closed idle browser session", { conversationId: id });
      }
    }
  }

  async shutdown(): Promise<void> {
    clearInterval(this.cleanupTimer);
    for (const session of this.sessions.values()) {
      await session.context.close().catch(() => {});
    }
    this.sessions.clear();
    await this.browser?.close().catch(() => {});
    this.browser = null;
  }
}
