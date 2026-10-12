/**
 * Google PageSpeed Insights API (v5) adapter.
 * Reuses the same Google Cloud API key as Places (BYOK).
 */

export type PageSpeedStrategy = "mobile" | "desktop";

export type PageSpeedResult = {
  strategy: PageSpeedStrategy;
  score: number | null;
  metrics: {
    lcpMs: number | null;
    cls: number | null;
    tbtMs: number | null;
    fcpMs: number | null;
    siMs: number | null;
  };
  error?: string;
  rawCategories?: Record<string, unknown>;
};

const PSI_URL = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const DEFAULT_TIMEOUT_MS = 45_000;

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (v && typeof v === "object" && "numericValue" in v) {
    const n = (v as { numericValue?: unknown }).numericValue;
    return typeof n === "number" && Number.isFinite(n) ? n : null;
  }
  return null;
}

export async function runPageSpeed(
  url: string,
  apiKey: string,
  strategy: PageSpeedStrategy,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<PageSpeedResult> {
  const endpoint = new URL(PSI_URL);
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("strategy", strategy);
  endpoint.searchParams.set("category", "performance");
  endpoint.searchParams.set("key", apiKey);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(endpoint.toString(), {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        strategy,
        score: null,
        metrics: { lcpMs: null, cls: null, tbtMs: null, fcpMs: null, siMs: null },
        error: `PSI HTTP ${res.status}: ${body.slice(0, 200)}`,
      };
    }
    const json = (await res.json()) as {
      lighthouseResult?: {
        categories?: { performance?: { score?: number } };
        audits?: Record<string, { numericValue?: number; score?: number }>;
      };
      error?: { message?: string };
    };

    if (json.error?.message) {
      return {
        strategy,
        score: null,
        metrics: { lcpMs: null, cls: null, tbtMs: null, fcpMs: null, siMs: null },
        error: json.error.message,
      };
    }

    const lr = json.lighthouseResult;
    const perf = lr?.categories?.performance?.score;
    const score =
      typeof perf === "number" ? Math.round(perf * 100) : null;
    const audits = lr?.audits ?? {};

    return {
      strategy,
      score,
      metrics: {
        lcpMs: num(audits["largest-contentful-paint"]),
        cls: num(audits["cumulative-layout-shift"]),
        tbtMs: num(audits["total-blocking-time"]),
        fcpMs: num(audits["first-contentful-paint"]),
        siMs: num(audits["speed-index"]),
      },
      rawCategories: lr?.categories as Record<string, unknown> | undefined,
    };
  } catch (err) {
    return {
      strategy,
      score: null,
      metrics: { lcpMs: null, cls: null, tbtMs: null, fcpMs: null, siMs: null },
      error: err instanceof Error ? err.message : "PageSpeed request failed",
    };
  } finally {
    clearTimeout(timer);
  }
}
