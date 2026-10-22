/**
 * Playwright deep-audit runner.
 * MUST only be imported from sales-audit-worker (never from Next.js request path).
 */

import type { Page } from "playwright";
import {
  assertSafeOutboundUrlResolved,
  isUrlBlockedAfterDns,
  isUrlClearlyUnsafe,
} from "@/lib/security/ssrf";
import {
  ALLOW_FORM_TEST_SUBMISSION,
  DEEP_AUDIT_SITE_TIMEOUT_MS,
  type DeepAuditBrowserResult,
  type DeepFinding,
} from "@/lib/audit/deep/types";

export type RunDeepBrowserOpts = {
  url: string;
  timeoutMs?: number;
};

async function installSsrfRoute(page: Page) {
  await page.route("**/*", async (route) => {
    const reqUrl = route.request().url();
    if (isUrlClearlyUnsafe(reqUrl)) {
      await route.abort();
      return;
    }
    if (await isUrlBlockedAfterDns(reqUrl)) {
      await route.abort();
      return;
    }
    await route.continue();
  });
}

function finding(
  id: string,
  severity: DeepFinding["severity"],
  title: string,
  evidence: string,
  viewport?: DeepFinding["viewport"]
): DeepFinding {
  return { id, severity, title, evidence, observed: true, viewport };
}

/**
 * Launch Chromium, capture desktop + iPhone viewport screenshots, collect findings.
 * Downloads / popups / geolocation / notifications disabled. Forms never submitted.
 */
export async function runDeepBrowserAudit(
  opts: RunDeepBrowserOpts
): Promise<DeepAuditBrowserResult> {
  const timeoutMs = opts.timeoutMs ?? DEEP_AUDIT_SITE_TIMEOUT_MS;
  // Dynamic import so Next web bundle never loads playwright at build time if unused
  const { chromium, devices } = await import("playwright");

  await assertSafeOutboundUrlResolved(opts.url, { allowHttp: true });

  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
  const findings: DeepFinding[] = [];
  const screenshots: DeepAuditBrowserResult["screenshots"] = {};
  let consoleErrors = 0;
  let brokenImages = 0;
  let finalUrl: string | null = null;
  let title: string | null = null;
  let hasViewportMeta = false;
  let formCount = false;
  let desktopLoadMs: number | undefined;
  let mobileLoadMs: number | undefined;

  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        "--disable-dev-shm-usage",
        "--no-sandbox",
        "--disable-gpu",
        "--disable-extensions",
      ],
    });

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      ignoreHTTPSErrors: false,
      acceptDownloads: false,
      javaScriptEnabled: true,
      permissions: [],
      geolocation: undefined,
    });
    await context.grantPermissions([]);
    context.setDefaultTimeout(timeoutMs);
    context.on("page", (p) => {
      // Block unexpected popups
      void p.close().catch(() => {});
    });

    const page = await context.newPage();
    await installSsrfRoute(page);
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors += 1;
    });
    page.on("pageerror", () => {
      consoleErrors += 1;
    });
    page.on("download", async (d) => {
      try {
        await d.cancel();
      } catch {
        /* ignore */
      }
    });

    // Deny notifications / geolocation prompts
    await page.addInitScript(() => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (navigator as any).geolocation = {
          getCurrentPosition: (_s: unknown, err: (e: GeolocationPositionError) => void) => {
            err({
              code: 1,
              message: "denied",
              PERMISSION_DENIED: 1,
              POSITION_UNAVAILABLE: 2,
              TIMEOUT: 3,
            } as GeolocationPositionError);
          },
          watchPosition: () => 0,
          clearWatch: () => {},
        };
      } catch {
        /* ignore */
      }
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((window as any).Notification) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).Notification.requestPermission = async () => "denied";
        }
      } catch {
        /* ignore */
      }
    });

    const t0 = Date.now();
    const resp = await page.goto(opts.url, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });
    desktopLoadMs = Date.now() - t0;
    finalUrl = page.url();
    title = await page.title().catch(() => null);

    if (!resp || !resp.ok()) {
      findings.push(
        finding(
          "http_error",
          "A",
          "Homepage returned an error status",
          `HTTP ${resp?.status() ?? 0} at ${finalUrl}`,
          "desktop"
        )
      );
    }

    const httpsOk = finalUrl?.startsWith("https://") ?? false;
    if (!httpsOk) {
      findings.push(
        finding(
          "no_https",
          "A",
          "Site is not served over HTTPS",
          `Final URL: ${finalUrl}`,
          "desktop"
        )
      );
    }

    hasViewportMeta = await page
      .locator('meta[name="viewport"]')
      .count()
      .then((n) => n > 0)
      .catch(() => false);
    if (!hasViewportMeta) {
      findings.push(
        finding(
          "no_viewport",
          "B",
          "Missing mobile viewport meta tag",
          "No <meta name=viewport> observed",
          "desktop"
        )
      );
    }

    const forms = await page.locator("form").count().catch(() => 0);
    formCount = forms > 0;
    // Policy: never submit forms in PoW1
    if (ALLOW_FORM_TEST_SUBMISSION) {
      throw new Error("Form submission must stay OFF");
    }

    const emptyCta = await page
      .evaluate(() => {
        const links = [...document.querySelectorAll("a, button")];
        return links.filter((el) => {
          const t = (el.textContent || "").trim();
          return t.length === 0 && el.getAttribute("href");
        }).length;
      })
      .catch(() => 0);
    if (emptyCta >= 3) {
      findings.push(
        finding(
          "empty_ctas",
          "C",
          "Multiple empty clickable labels",
          `Observed ${emptyCta} empty a/button nodes`,
          "desktop"
        )
      );
    }

    brokenImages = await page
      .evaluate(() => {
        const imgs = [...document.images];
        return imgs.filter((img) => !img.complete || img.naturalWidth === 0)
          .length;
      })
      .catch(() => 0);
    if (brokenImages > 0) {
      findings.push(
        finding(
          "broken_images",
          "B",
          "Broken images on homepage",
          `${brokenImages} image(s) failed to load`,
          "desktop"
        )
      );
    }

    if (consoleErrors >= 5) {
      findings.push(
        finding(
          "console_errors",
          "B",
          "Many console errors on load",
          `${consoleErrors} console/page errors observed`,
          "desktop"
        )
      );
    }

    if (desktopLoadMs > 8_000) {
      findings.push(
        finding(
          "slow_desktop",
          "B",
          "Slow desktop first content",
          `domcontentloaded in ${desktopLoadMs}ms`,
          "desktop"
        )
      );
    }

    screenshots.desktop = await page.screenshot({
      fullPage: false,
      type: "png",
    });

    // Mobile (iPhone) viewport
    const iphone = devices["iPhone 13"] || devices["iPhone 12"];
    const mobileCtx = await browser.newContext({
      ...iphone,
      acceptDownloads: false,
      permissions: [],
    });
    const mobile = await mobileCtx.newPage();
    await installSsrfRoute(mobile);
    const tm = Date.now();
    await mobile.goto(finalUrl || opts.url, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });
    mobileLoadMs = Date.now() - tm;
    if (mobileLoadMs > 10_000) {
      findings.push(
        finding(
          "slow_mobile",
          "A",
          "Slow mobile load",
          `domcontentloaded in ${mobileLoadMs}ms on iPhone viewport`,
          "mobile"
        )
      );
    }
    const hOverflow = await mobile
      .evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 8)
      .catch(() => false);
    if (hOverflow) {
      findings.push(
        finding(
          "mobile_overflow",
          "A",
          "Horizontal overflow on mobile",
          "document scrollWidth exceeds viewport",
          "mobile"
        )
      );
    }
    screenshots.mobile = await mobile.screenshot({
      fullPage: false,
      type: "png",
    });
    await mobileCtx.close();
    await context.close();

    return {
      ok: true,
      finalUrl,
      title,
      findings,
      screenshots,
      metrics: {
        desktopLoadMs,
        mobileLoadMs,
        consoleErrors,
        brokenImages,
        hasViewportMeta,
        hasHttps: httpsOk,
        formCount,
        formSubmitAttempted: false,
      },
    };
  } catch (err) {
    return {
      ok: false,
      finalUrl,
      title,
      findings,
      screenshots,
      metrics: {
        desktopLoadMs,
        mobileLoadMs,
        consoleErrors,
        brokenImages,
        hasViewportMeta,
        hasHttps: Boolean(finalUrl?.startsWith("https://")),
        formCount,
        formSubmitAttempted: false,
      },
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

/** Best-effort kill orphaned chromium from this worker (Linux/mac). */
export async function killOrphanedChromium(): Promise<void> {
  if (process.platform === "win32") return;
  try {
    const { execFile } = await import("child_process");
    const { promisify } = await import("util");
    const exec = promisify(execFile);
    // Only match playwright-managed chromium; avoid killing unrelated Chrome
    await exec("pkill", ["-f", "ms-playwright.*chrome"], {
      timeout: 5000,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}
