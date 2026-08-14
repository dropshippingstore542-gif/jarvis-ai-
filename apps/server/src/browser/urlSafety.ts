import dns from "node:dns/promises";
import net from "node:net";

export class UnsafeUrlError extends Error {
  constructor(raw: string, reason: string) {
    super(`Refusing to navigate to "${raw}": ${reason}`);
    this.name = "UnsafeUrlError";
  }
}

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

function inCidr(ip: string, base: string, bits: number): boolean {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask);
}

/**
 * Blocks loopback, private, link-local (including the 169.254.169.254 cloud
 * metadata endpoint), and unspecified addresses — the standard SSRF
 * denylist for a tool that lets a model cause the server to make arbitrary
 * outbound requests. Resolves hostnames first so a DNS name that points at
 * an internal address is caught too (not just IP literals).
 */
function isBlockedIPv4(ip: string): boolean {
  return (
    inCidr(ip, "127.0.0.0", 8) ||
    inCidr(ip, "10.0.0.0", 8) ||
    inCidr(ip, "172.16.0.0", 12) ||
    inCidr(ip, "192.168.0.0", 16) ||
    inCidr(ip, "169.254.0.0", 16) ||
    ip === "0.0.0.0"
  );
}

function isBlockedIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  return (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80")
  );
}

export async function assertSafeHttpUrl(
  raw: string,
  opts: { allowPrivateNetworks?: boolean } = {},
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError(raw, "not a valid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError(raw, "only http/https URLs are allowed.");
  }
  if (opts.allowPrivateNetworks) return url;

  const hostname = url.hostname;
  if (hostname === "localhost") {
    throw new UnsafeUrlError(raw, "requests to localhost are blocked.");
  }

  const ipVersion = net.isIP(hostname);
  if (ipVersion === 4 && isBlockedIPv4(hostname)) {
    throw new UnsafeUrlError(raw, "requests to private/loopback/link-local addresses are blocked.");
  }
  if (ipVersion === 6 && isBlockedIPv6(hostname)) {
    throw new UnsafeUrlError(raw, "requests to private/loopback/link-local addresses are blocked.");
  }

  if (ipVersion === 0) {
    let addresses: { address: string; family: number }[];
    try {
      addresses = await dns.lookup(hostname, { all: true });
    } catch {
      throw new UnsafeUrlError(raw, `could not resolve hostname "${hostname}".`);
    }
    for (const { address, family } of addresses) {
      if (family === 4 && isBlockedIPv4(address)) {
        throw new UnsafeUrlError(raw, `"${hostname}" resolves to a private/internal address (${address}).`);
      }
      if (family === 6 && isBlockedIPv6(address)) {
        throw new UnsafeUrlError(raw, `"${hostname}" resolves to a private/internal address (${address}).`);
      }
    }
  }

  return url;
}
