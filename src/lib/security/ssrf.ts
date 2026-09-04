import { ValidationError } from "@/lib/api/response";

const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "metadata.google.internal",
  "169.254.169.254",
]);

/**
 * SSRF guard for outbound HTTP from connectors.
 * Only https to public hosts; optional allowlist of host suffixes.
 */
export function assertSafeOutboundUrl(
  rawUrl: string,
  allowedHostSuffixes?: string[]
): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new ValidationError("Invalid outbound URL");
  }

  if (url.protocol !== "https:") {
    throw new ValidationError("Only HTTPS outbound URLs are allowed");
  }

  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new ValidationError("Outbound host is blocked");
  }

  // Block obvious private IPv4
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|127\.)/.test(host)) {
    throw new ValidationError("Private network hosts are blocked");
  }

  if (allowedHostSuffixes?.length) {
    const ok = allowedHostSuffixes.some(
      (suffix) => host === suffix || host.endsWith(`.${suffix}`)
    );
    if (!ok) {
      throw new ValidationError(`Host ${host} is not in the allowlist`);
    }
  }

  return url;
}
