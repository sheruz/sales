/**
 * PoW1 accuracy re-run: Playwright deep audit + optional PSI on live URLs.
 * Usage:
 *   node scripts/run-with-env.js node_modules/tsx/dist/cli.mjs scripts/_pow1-live-audit.ts
 *   POW1_AUDIT_URLS=https://a.com,https://b.com ...
 */
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { runDeepBrowserAudit } from "../src/lib/audit/deep/browser-runner";
import {
  sortFindings,
  speedFindingFromPageSpeed,
} from "../src/lib/audit/deep/findings";
import { runPageSpeed } from "../src/lib/audit/pagespeed.adapter";
import type { DeepFinding } from "../src/lib/audit/deep/types";

const DEFAULT_URLS = [
  "https://managemyproperty.ae",
  "https://www.koreanbowl.ae",
  "https://example.com",
];

function urlsFromEnv(): string[] {
  const raw = process.env.POW1_AUDIT_URLS?.trim();
  if (!raw) return DEFAULT_URLS;
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function summarizeFinding(f: DeepFinding) {
  return {
    id: f.id,
    severity: f.severity,
    confidence: f.confidence,
    emailEligible: f.emailEligible,
    title: f.title,
    evidence: f.evidence.slice(0, 240),
  };
}

async function auditOne(url: string, outDir: string) {
  console.log(`\n═══ ${url} ═══`);
  const started = Date.now();
  const browser = await runDeepBrowserAudit({ url, timeoutMs: 60_000 });
  if (!browser.ok) {
    console.log("BROWSER FAIL", browser.error);
    return {
      url,
      ok: false as const,
      error: browser.error,
      ms: Date.now() - started,
    };
  }

  let findings = [...browser.findings];
  let psi: Record<string, unknown> | null = null;
  const apiKey =
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_PLACES_API_KEY ||
    process.env.PAGESPEED_API_KEY ||
    "";

  if (apiKey) {
    try {
      const result = await runPageSpeed(
        browser.finalUrl || url,
        apiKey,
        "mobile",
        45_000
      );
      psi = {
        score: result.score,
        lcpMs: result.metrics.lcpMs,
        fieldLcpMs: result.fieldMetrics?.lcpMs ?? null,
        fieldCategory: result.fieldMetrics?.category ?? null,
        error: result.error ?? null,
      };
      const speed = speedFindingFromPageSpeed({
        psi: result,
        playwrightMobileMs: browser.metrics.mobileLoadMs,
        playwrightDesktopMs: browser.metrics.desktopLoadMs,
      });
      if (speed) findings.push(speed);
    } catch (e) {
      psi = { error: e instanceof Error ? e.message : String(e) };
    }
  } else {
    psi = { skipped: "no Google API key in env — PSI via pagespeed.web.dev already checked for MMP" };
  }

  findings = sortFindings(findings);

  const m = browser.metrics;
  const falseARisk = findings.filter(
    (f) => f.severity === "A" && f.id === "broken_images"
  );
  const speedFindings = findings.filter(
    (f) => f.id.includes("slow") || f.id.includes("psi")
  );

  const summary = {
    url,
    ok: true as const,
    finalUrl: browser.finalUrl,
    title: browser.title,
    ms: Date.now() - started,
    metrics: m,
    consentBannerVisible: m.consentBannerVisible,
    brokenImages: m.brokenImages,
    brokenImageUrls: m.brokenImageUrls?.slice(0, 8),
    consoleErrors: m.consoleErrors,
    sslDays: m.sslExpiresInDays,
    psi,
    findingCount: findings.length,
    severityA: findings.filter((f) => f.severity === "A").map(summarizeFinding),
    severityB: findings.filter((f) => f.severity === "B").map(summarizeFinding),
    severityC: findings.filter((f) => f.severity === "C").map(summarizeFinding),
    checks: {
      // broken_images is Severity B in current runner (never A)
      brokenImagesNeverA: falseARisk.length === 0,
      speedIsBOrAbsent: speedFindings.every((f) => f.severity === "B"),
      noSpeedA: !findings.some(
        (f) =>
          f.severity === "A" &&
          (f.id.includes("slow") || f.id.includes("psi"))
      ),
    },
  };

  console.log(JSON.stringify(summary, null, 2));

  if (browser.screenshots.desktop) {
    writeFileSync(
      join(outDir, `${slug(url)}-desktop.png`),
      browser.screenshots.desktop
    );
  }
  if (browser.screenshots.mobile) {
    writeFileSync(
      join(outDir, `${slug(url)}-mobile.png`),
      browser.screenshots.mobile
    );
  }

  return summary;
}

function slug(url: string) {
  return url.replace(/^https?:\/\//, "").replace(/[^\w.-]+/g, "_").slice(0, 60);
}

async function main() {
  const urls = urlsFromEnv();
  const outDir = join(process.cwd(), "storage", "pow1-live-audit");
  mkdirSync(outDir, { recursive: true });
  console.log("PoW1 live audit", { urls, outDir });

  const results = [];
  for (const url of urls) {
    results.push(await auditOne(url, outDir));
  }

  writeFileSync(join(outDir, "summary.json"), JSON.stringify(results, null, 2));
  console.log("\n═══ SIGN-OFF ROLLUP ═══");
  for (const r of results) {
    if (!r.ok) {
      console.log(`FAIL ${r.url}: ${r.error}`);
      continue;
    }
    const a = (r as { severityA: unknown[] }).severityA?.length ?? 0;
    const b = (r as { severityB: unknown[] }).severityB?.length ?? 0;
    const c = (r as { severityC: unknown[] }).severityC?.length ?? 0;
    const checks = (r as { checks: Record<string, boolean> }).checks;
    console.log(
      `${r.url}  A=${a} B=${b} C=${c}  brokenImages=${(r as { brokenImages?: number }).brokenImages}  checks=${JSON.stringify(checks)}`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
