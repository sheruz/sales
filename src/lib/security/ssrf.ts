import { lookup } from "dns/promises";
import { isIP } from "net";
import { ValidationError } from "@/lib/api/response";

const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "metadata.google.internal",
  "169.254.169.254",
]);

export type SafeUrlOptions = {
  /** Optional host-suffix allowlist (connectors). */
  allowedHostSuffixes?: string[];
  /**
   * When false (default), only https: — connector policy.
   * Audit/crawler set true to allow http: → https redirects.
   */
  allowHttp?: boolean;
};

function parseUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new ValidationError("Invalid outbound URL");
  }
  return url;
}

function assertScheme(url: URL, allowHttp: boolean) {
  if (url.protocol === "https:") return;
  if (allowHttp && url.protocol === "http:") return;
  throw new ValidationError(
    allowHttp
      ? "Only http(s) outbound URLs are allowed"
      : "Only HTTPS outbound URLs are allowed"
  );
}

function assertHostnameNotBlocked(host: string) {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTS.has(h) || h.endsWith(".local") || h.endsWith(".internal")) {
    throw new ValidationError("Outbound host is blocked");
  }
}

/** True if IPv4/IPv6 is private, loopback, link-local, or ULA. */
export function isBlockedIpAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const parts = ip.split(".").map((p) => Number(p));
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }
  if (v === 6) {
    const normalized = ip.toLowerCase();
    if (normalized === "::1" || normalized === "::") return true;
    // IPv4-mapped ::ffff:x.x.x.x
    const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isBlockedIpAddress(mapped[1]);
    // Unique local fc00::/7
    if (
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fc00:") ||
      normalized.startsWith("fd00:")
    ) {
      return true;
    }
    // Link-local fe80::/10
    if (
      normalized.startsWith("fe8") ||
      normalized.startsWith("fe9") ||
      normalized.startsWith("fea") ||
      normalized.startsWith("feb") ||
      normalized.startsWith("fe80:")
    ) {
      return true;
    }
    return false;
  }
  return true;
}

function assertAllowlist(host: string, suffixes?: string[]) {
  if (!suffixes?.length) return;
  const h = host.toLowerCase();
  const ok = suffixes.some(
    (suffix) => h === suffix || h.endsWith(`.${suffix}`)
  );
  if (!ok) {
    throw new ValidationError(`Host ${h} is not in the allowlist`);
  }
}

/**
 * Sync SSRF guard (scheme + literal host/IP). Does not DNS-resolve.
 * Prefer assertSafeOutboundUrlResolved before any network I/O.
 */
export function assertSafeOutboundUrl(
  rawUrl: string,
  allowedHostSuffixesOrOpts?: string[] | SafeUrlOptions
): URL {
  const opts: SafeUrlOptions = Array.isArray(allowedHostSuffixesOrOpts)
    ? { allowedHostSuffixes: allowedHostSuffixesOrOpts }
    : allowedHostSuffixesOrOpts ?? {};
  const allowHttp = Boolean(opts.allowHttp);
  const url = parseUrl(rawUrl);
  assertScheme(url, allowHttp);

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  assertHostnameNotBlocked(host);

  if (isIP(host) && isBlockedIpAddress(host)) {
    throw new ValidationError("Private network hosts are blocked");
  }

  // Hostname that looks like a private IPv4 string without isIP edge cases
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|127\.|169\.254\.)/.test(host)) {
    throw new ValidationError("Private network hosts are blocked");
  }

  assertAllowlist(host, opts.allowedHostSuffixes);
  return url;
}

/**
 * Resolve hostname and block private / metadata / loopback / link-local ranges.
 * Call before every outbound hop (including redirect targets).
 */
export async function assertSafeOutboundUrlResolved(
  rawUrl: string,
  opts?: SafeUrlOptions
): Promise<URL> {
  const url = assertSafeOutboundUrl(rawUrl, opts);
  const host = url.hostname.replace(/^\[|\]$/g, "");

  if (isIP(host)) {
    if (isBlockedIpAddress(host)) {
      throw new ValidationError("Private network hosts are blocked");
    }
    return url;
  }

  let records: { address: string; family: number }[];
  try {
    records = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw new ValidationError("Outbound host could not be resolved");
  }
  if (!records.length) {
    throw new ValidationError("Outbound host could not be resolved");
  }
  for (const rec of records) {
    if (isBlockedIpAddress(rec.address)) {
      throw new ValidationError("Outbound host resolves to a blocked address");
    }
  }
  return url;
}

export type SafeFetchInit = RequestInit & {
  /** Max redirects (default 5). Each hop is SSRF-checked. */
  maxRedirects?: number;
  ssrf?: SafeUrlOptions;
};

/**
 * fetch() that never auto-follows redirects: validates DNS+ranges on every hop.
 */
export async function safeFetch(
  rawUrl: string,
  init: SafeFetchInit = {}
): Promise<Response> {
  const maxRedirects = init.maxRedirects ?? 5;
  const { maxRedirects: _m, ssrf, ...rest } = init;
  const opts: SafeUrlOptions = { allowHttp: true, ...ssrf };

  let current = rawUrl;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    await assertSafeOutboundUrlResolved(current, opts);
    const res = await fetch(current, {
      ...rest,
      redirect: "manual",
    });

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) {
        throw new ValidationError("Redirect without Location header");
      }
      current = new URL(loc, current).toString();
      continue;
    }
    return res;
  }
  throw new ValidationError("Too many redirects");
}

/** Playwright / route handler: abort if URL is unsafe (sync + literal IP only; resolve async separately). */
export function isUrlClearlyUnsafe(rawUrl: string): boolean {
  try {
    assertSafeOutboundUrl(rawUrl, { allowHttp: true });
    return false;
  } catch {
    return true;
  }
}

export async function isUrlBlockedAfterDns(rawUrl: string): Promise<boolean> {
  try {
    await assertSafeOutboundUrlResolved(rawUrl, { allowHttp: true });
    return false;
  } catch {
    return true;
  }
}
