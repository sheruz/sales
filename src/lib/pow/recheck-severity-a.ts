/**
 * PoW2/PoW3: re-fetch the URL and confirm a Severity A finding is still broken
 * before the first send. If fixed → draft marked stale.
 */

import { assertSafeOutboundUrlResolved } from "@/lib/security/ssrf";
import { safeFetch } from "@/lib/security/ssrf";

export type RecheckResult = {
  stillBroken: boolean;
  status: number | null;
  detail: string;
};

/**
 * Re-check a Severity A finding against the live URL.
 * Supports http_error / no_https / ssl_expiring / mobile_overflow (best-effort).
 */
export async function recheckSeverityAFinding(opts: {
  findingId: string;
  url: string;
  evidence?: string;
}): Promise<RecheckResult> {
  const { findingId, url } = opts;
  await assertSafeOutboundUrlResolved(url, { allowHttp: true });

  const id = findingId.toLowerCase();

  if (id === "no_https" || id.includes("https")) {
    const stillBroken = !url.toLowerCase().startsWith("https://");
    return {
      stillBroken,
      status: null,
      detail: stillBroken
        ? `URL is still not HTTPS: ${url}`
        : `URL is now HTTPS: ${url}`,
    };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    let res: Response;
    try {
      res = await safeFetch(url, {
        ssrf: { allowHttp: true },
        maxRedirects: 3,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    const status = res.status;
    const finalUrl = res.url;

    if (id === "http_error" || id.includes("http_error")) {
      const stillBroken = status >= 400;
      return {
        stillBroken,
        status,
        detail: stillBroken
          ? `Still error status HTTP ${status}`
          : `Now HTTP ${status} (fixed)`,
      };
    }

    if (id.includes("ssl") || id.includes("expir")) {
      // If we fetched over HTTPS successfully, treat as not expired for now
      const okHttps = finalUrl.startsWith("https://") && status < 400;
      return {
        stillBroken: !okHttps,
        status,
        detail: okHttps
          ? "HTTPS fetch succeeded (certificate appears valid)"
          : `HTTPS/ssl issue persists (HTTP ${status})`,
      };
    }

    // Generic A: page still erroring
    if (status >= 400) {
      return {
        stillBroken: true,
        status,
        detail: `HTTP ${status}`,
      };
    }

    return {
      stillBroken: false,
      status,
      detail: `HTTP ${status} — finding may be fixed; mark stale if product still expects breakage`,
    };
  } catch (err) {
    return {
      stillBroken: true,
      status: null,
      detail: err instanceof Error ? err.message : "fetch failed",
    };
  }
}
