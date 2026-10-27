/**
 * Playwright deep-audit runner.
 * MUST only be imported from sales-audit-worker (never from Next.js request path).
 *
 * Accuracy rules (PoW1):
 * - Speed findings are NOT emitted here (PageSpeed Insights is the source).
 * - Severity A = actually broken only.
 * - Broken images = HTTP 4xx/5xx or network error after full-page scroll (lazy load).
 * - Dismiss consent banners before screenshots when possible.
 */

import type { Page, Response } from "playwright";
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
import { makeFinding, sortFindings } from "@/lib/audit/deep/findings";

export type RunDeepBrowserOpts = {
  url: string;
  timeoutMs?: number;
};

const CONSENT_BUTTON_RE =
  /\b(reject\s*all|reject|deny|decline|necessary\s*only|essential\s*only|only\s*necessary|only\s*essential|refuse|不同意|ablehnen)\b/i;

const CONSENT_SELECTORS = [
  // OneTrust
  "#onetrust-reject-all-handler",
  "button#onetrust-reject-all-handler",
  ".ot-pc-refuse-all-handler",
  // Cookiebot
  "#CybotCookiebotDialogBodyButtonDecline",
  "#CybotCookiebotDialogBodyLevelButtonLevelOptinDeclineAll",
  // CookieHub
  ".ch2-dialog-btn-decline",
  "button[data-ch2-action='decline']",
  "button[data-action='decline']",
  ".ch2-dialog button.ch2-btn-deny",
  "button.ch2-btn-deny",
  // CookieHub visible label is often "Deny all" (matched via text regex too)

  // Complianz
  ".cmplz-btn.cmplz-deny",
  ".cmplz-deny",
  "button.cmplz-deny",
  // Generic
  '[aria-label*="Reject" i]',
  '[aria-label*="Decline" i]',
  '[aria-label*="Deny" i]',
  'button[id*="reject" i]',
  'button[class*="reject" i]',
  'button[class*="deny" i]',
  'button[class*="decline" i]',
];

async function installSsrfRoute(
  page: Page,
  abortedUrls: Set<string>
) {
  await page.route("**/*", async (route) => {
    const req = route.request();
    const reqUrl = req.url();
    // Never block images for audit accuracy — only abort clearly unsafe non-image targets
    const rt = req.resourceType();
    const isImage = rt === "image" || rt === "media";
    if (isUrlClearlyUnsafe(reqUrl)) {
      if (!isImage) {
        abortedUrls.add(reqUrl);
        await route.abort();
        return;
      }
      // Images to clearly-unsafe hosts: still abort (SSRF) but track so we don't count as broken
      abortedUrls.add(reqUrl);
      await route.abort();
      return;
    }
    if (await isUrlBlockedAfterDns(reqUrl)) {
      abortedUrls.add(reqUrl);
      await route.abort();
      return;
    }
    await route.continue();
  });
}

async function dismissConsentBanner(page: Page): Promise<boolean> {
  // Prefer known vendor selectors
  for (const sel of CONSENT_SELECTORS) {
    try {
      const loc = page.locator(sel).first();
      if (await loc.isVisible({ timeout: 400 }).catch(() => false)) {
        await loc.click({ timeout: 1500 }).catch(() => {});
        await page.waitForTimeout(400);
        return true;
      }
    } catch {
      /* try next */
    }
  }
  // Text-match buttons / links
  try {
    const clicked = await page.evaluate((reSource) => {
      const re = new RegExp(reSource, "i");
      const nodes = [
        ...document.querySelectorAll("button, a, [role='button']"),
      ] as HTMLElement[];
      for (const el of nodes) {
        const t = (el.innerText || el.getAttribute("aria-label") || "").trim();
        if (t && re.test(t) && el.offsetParent !== null) {
          el.click();
          return true;
        }
      }
      return false;
    }, CONSENT_BUTTON_RE.source);
    if (clicked) {
      await page.waitForTimeout(400);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

async function consentStillVisible(page: Page): Promise<boolean> {
  return page
    .evaluate(() => {
      const text = (document.body?.innerText || "").toLowerCase();
      const hints =
        text.includes("cookie") ||
        text.includes("consent") ||
        text.includes("privacy preference");
      if (!hints) return false;
      const dialogs = document.querySelectorAll(
        '[id*="cookie" i], [class*="cookie" i], [id*="consent" i], [class*="consent" i], #onetrust-banner-sdk, #CybotCookiebotDialog, .cmplz-cookiebanner'
      );
      for (const d of dialogs) {
        const el = d as HTMLElement;
        if (el.offsetParent !== null && el.getBoundingClientRect().height > 40) {
          return true;
        }
      }
      return false;
    })
    .catch(() => false);
}

async function scrollFullPage(page: Page) {
  await page
    .evaluate(async () => {
      const delay = (ms: number) =>
        new Promise((r) => setTimeout(r, ms));
      const height = Math.max(
        document.body?.scrollHeight || 0,
        document.documentElement?.scrollHeight || 0
      );
      const step = Math.max(400, Math.floor(window.innerHeight * 0.85));
      for (let y = 0; y < height; y += step) {
        window.scrollTo(0, y);
        await delay(120);
      }
      window.scrollTo(0, height);
      await delay(300);
      window.scrollTo(0, 0);
      await delay(200);
    })
    .catch(() => {});
}

function trackBrokenImages(
  page: Page,
  abortedUrls: Set<string>,
  broken: Map<string, string>
) {
  page.on("response", (resp: Response) => {
    try {
      const req = resp.request();
      if (req.resourceType() !== "image") return;
      const url = resp.url();
      if (abortedUrls.has(url)) return;
      const status = resp.status();
      if (status >= 400) {
        broken.set(url, `HTTP ${status}`);
      }
    } catch {
      /* ignore */
    }
  });
  page.on("requestfailed", (req) => {
    try {
      if (req.resourceType() !== "image") return;
      const url = req.url();
      if (abortedUrls.has(url)) return;
      const failure = req.failure()?.errorText || "network error";
      // Abort from our route shows as net::ERR_FAILED / aborted — skip those
      if (/ERR_ABORTED|canceled|cancelled/i.test(failure)) return;
      broken.set(url, failure);
    } catch {
      /* ignore */
    }
  });
}

async function collectSslDays(mainResp: Response | null): Promise<number | null> {
  try {
    const details = mainResp ? await mainResp.securityDetails() : null;
    if (!details?.validTo) return null;
    const expiry = new Date(details.validTo).getTime();
    if (!Number.isFinite(expiry)) return null;
    return Math.floor((expiry - Date.now()) / (24 * 60 * 60 * 1000));
  } catch {
    return null;
  }
}

/**
 * Launch Chromium, capture desktop + iPhone viewport screenshots, collect findings.
 * Downloads / popups / geolocation / notifications disabled. Forms never submitted.
 * Does NOT emit speed findings (PSI owns those).
 */
export async function runDeepBrowserAudit(
  opts: RunDeepBrowserOpts
): Promise<DeepAuditBrowserResult> {
  const timeoutMs = opts.timeoutMs ?? DEEP_AUDIT_SITE_TIMEOUT_MS;
  const { chromium, devices } = await import("playwright");

  await assertSafeOutboundUrlResolved(opts.url, { allowHttp: true });

  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
  const findings: DeepFinding[] = [];
  const screenshots: DeepAuditBrowserResult["screenshots"] = {};
  let consoleErrors = 0;
  let brokenImages = 0;
  let brokenImageUrls: string[] = [];
  let finalUrl: string | null = null;
  let title: string | null = null;
  let hasViewportMeta = false;
  let formCount = false;
  let desktopLoadMs: number | undefined;
  let mobileLoadMs: number | undefined;
  let consentBannerVisible = false;
  let sslDays: number | null = null;

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

    const page = await context.newPage();
    page.on("popup", (popup) => {
      void popup.close().catch(() => {});
    });

    const abortedUrls = new Set<string>();
    const brokenMap = new Map<string, string>();
    await installSsrfRoute(page, abortedUrls);
    trackBrokenImages(page, abortedUrls, brokenMap);

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
    sslDays = await collectSslDays(resp);

    if (!resp || !resp.ok()) {
      findings.push(
        makeFinding({
          id: "http_error",
          severity: "A",
          title: "Homepage returns an error",
          whyItMatters:
            "Visitors and Google see a broken page instead of your business.",
          evidence: `HTTP ${resp?.status() ?? 0} at ${finalUrl}`,
          confidence: "High",
          viewport: "desktop",
        })
      );
    }

    const httpsOk = finalUrl?.startsWith("https://") ?? false;
    if (!httpsOk) {
      findings.push(
        makeFinding({
          id: "no_https",
          severity: "A",
          title: "Site is not using a secure connection (HTTPS)",
          whyItMatters:
            "Browsers warn visitors, and many owners will not trust the page.",
          evidence: `Final URL: ${finalUrl}`,
          confidence: "High",
          viewport: "desktop",
        })
      );
    } else if (sslDays != null && sslDays < 30) {
      findings.push(
        makeFinding({
          id: "ssl_expiring",
          severity: "A",
          title:
            sslDays < 0
              ? "SSL certificate has expired"
              : "SSL certificate expires within 30 days",
          whyItMatters:
            "When the certificate fails, browsers block the site with a scary warning.",
          evidence: `Certificate validTo days remaining: ${sslDays}`,
          confidence: "High",
          viewport: "desktop",
        })
      );
    }

    hasViewportMeta = await page
      .locator('meta[name="viewport"]')
      .count()
      .then((n) => n > 0)
      .catch(() => false);
    if (!hasViewportMeta) {
      findings.push(
        makeFinding({
          id: "no_viewport",
          severity: "B",
          title: "Page is not set up for phones",
          whyItMatters:
            "Without a mobile viewport tag the layout often looks zoomed-out or broken on phones.",
          evidence: "No <meta name=viewport> observed",
          confidence: "High",
          viewport: "desktop",
        })
      );
    }

    const forms = await page.locator("form").count().catch(() => 0);
    formCount = forms > 0;
    if (ALLOW_FORM_TEST_SUBMISSION) {
      throw new Error("Form submission must stay OFF");
    }

    // Trigger lazy-loaded images before counting failures
    await scrollFullPage(page);
    await page.waitForTimeout(800);

    brokenImageUrls = [...brokenMap.keys()].slice(0, 40);
    brokenImages = brokenMap.size;
    if (brokenImages >= 1) {
      const sample = brokenImageUrls.slice(0, 8).join("\n");
      findings.push(
        makeFinding({
          id: "broken_images",
          severity: "B",
          title:
            brokenImages === 1
              ? "1 image failed to load"
              : `${brokenImages} images failed to load`,
          whyItMatters:
            "Missing pictures make the site look unfinished and hurt trust.",
          evidence: `Confirmed HTTP/network failures after full-page scroll:\n${sample}`,
          confidence: "High",
          viewport: "desktop",
        })
      );
    }

    const emptyCta = await page
      .evaluate(() => {
        const links = [...document.querySelectorAll("a, button")];
        return links.filter((el) => {
          const t = (el.textContent || "").trim();
          const aria = (el.getAttribute("aria-label") || "").trim();
          const titleAttr = (el.getAttribute("title") || "").trim();
          return t.length === 0 && !aria && !titleAttr && el.getAttribute("href");
        }).length;
      })
      .catch(() => 0);
    if (emptyCta >= 3) {
      findings.push(
        makeFinding({
          id: "empty_ctas",
          severity: "C",
          title: `${emptyCta} buttons or links have no text`,
          whyItMatters:
            "Screen readers and Google can’t tell what those controls do.",
          evidence: `Observed ${emptyCta} empty a/button nodes (no text, aria-label, or title)`,
          confidence: "Medium",
          viewport: "desktop",
        })
      );
    }

    if (consoleErrors >= 5) {
      findings.push(
        makeFinding({
          id: "console_errors",
          severity: "C",
          title: "The page logs many technical errors",
          whyItMatters:
            "Lots of script errors often mean features break for some visitors.",
          evidence: `${consoleErrors} console/page errors observed`,
          confidence: "Medium",
          viewport: "desktop",
        })
      );
    }

    const dismissed = await dismissConsentBanner(page);
    consentBannerVisible = await consentStillVisible(page);
    if (!dismissed && consentBannerVisible) {
      // still take screenshot; mark evidence
    }

    screenshots.desktop = await page.screenshot({
      fullPage: false,
      type: "png",
    });

    // Mobile (iPhone) viewport
    const iphone = devices["iPhone 13"] || devices["iPhone 12"];
    const mobileAborted = new Set<string>();
    const mobileBroken = new Map<string, string>();
    const mobileCtx = await browser.newContext({
      ...iphone,
      acceptDownloads: false,
      permissions: [],
    });
    const mobile = await mobileCtx.newPage();
    mobile.on("popup", (popup) => {
      void popup.close().catch(() => {});
    });
    await installSsrfRoute(mobile, mobileAborted);
    trackBrokenImages(mobile, mobileAborted, mobileBroken);

    const tm = Date.now();
    await mobile.goto(finalUrl || opts.url, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });
    mobileLoadMs = Date.now() - tm;

    await dismissConsentBanner(mobile);
    const mobileConsent = await consentStillVisible(mobile);
    if (mobileConsent) consentBannerVisible = true;

    await scrollFullPage(mobile);

    const hOverflow = await mobile
      .evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 8)
      .catch(() => false);
    if (hOverflow) {
      findings.push(
        makeFinding({
          id: "mobile_overflow",
          severity: "A",
          title: "Page scrolls sideways on phones",
          whyItMatters:
            "Horizontal scrolling makes the site feel broken on mobile.",
          evidence: "document scrollWidth exceeds viewport by >8px",
          confidence: "High",
          viewport: "mobile",
        })
      );
    }

    // Overlapping layout heuristic: fixed overlays covering most of content after consent dismiss
    const heavyOverlap = await mobile
      .evaluate(() => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const blockers = [...document.querySelectorAll("div, section, aside")].filter(
          (el) => {
            const s = window.getComputedStyle(el);
            if (s.position !== "fixed" && s.position !== "sticky") return false;
            const r = el.getBoundingClientRect();
            return r.width > vw * 0.85 && r.height > vh * 0.5;
          }
        );
        return blockers.length > 0;
      })
      .catch(() => false);
    if (heavyOverlap && consentBannerVisible) {
      // Overlap from cookie banner is noted in screenshot evidence, not a layout A finding
    } else if (heavyOverlap && !consentBannerVisible) {
      findings.push(
        makeFinding({
          id: "mobile_overlap",
          severity: "A",
          title: "Content is covered by an overlay on phones",
          whyItMatters:
            "Visitors can’t read or tap the page when something sits on top of it.",
          evidence: "Fixed/sticky element covering >85% width and >50% height",
          confidence: "Medium",
          viewport: "mobile",
        })
      );
    }

    screenshots.mobile = await mobile.screenshot({
      fullPage: false,
      type: "png",
    });

    // Merge any additional mobile image failures (same URL set)
    for (const [url, reason] of mobileBroken) {
      if (!brokenMap.has(url) && !abortedUrls.has(url)) {
        brokenMap.set(url, reason);
      }
    }
    if (brokenMap.size > brokenImages) {
      // Update broken-images finding if we underestimated on desktop
      const idx = findings.findIndex((f) => f.id === "broken_images");
      brokenImages = brokenMap.size;
      brokenImageUrls = [...brokenMap.keys()].slice(0, 40);
      const sample = brokenImageUrls.slice(0, 8).join("\n");
      const updated = makeFinding({
        id: "broken_images",
        severity: "B",
        title:
          brokenImages === 1
            ? "1 image failed to load"
            : `${brokenImages} images failed to load`,
        whyItMatters:
          "Missing pictures make the site look unfinished and hurt trust.",
        evidence: `Confirmed HTTP/network failures after full-page scroll:\n${sample}`,
        confidence: "High",
        viewport: "both",
      });
      if (idx >= 0) findings[idx] = updated;
      else findings.push(updated);
    }

    if (consentBannerVisible) {
      // Annotate screenshot-related evidence via a C note only if we couldn't dismiss
      findings.push(
        makeFinding({
          id: "consent_banner_visible",
          severity: "C",
          title: "Cookie banner was still visible in screenshots",
          whyItMatters:
            "Proof screenshots may show the banner instead of the real homepage.",
          evidence: "consent banner visible",
          confidence: "Medium",
          viewport: "both",
        })
      );
    }

    await mobileCtx.close();
    await context.close();

    return {
      ok: true,
      finalUrl,
      title,
      findings: sortFindings(findings),
      screenshots,
      metrics: {
        desktopLoadMs,
        mobileLoadMs,
        consoleErrors,
        brokenImages,
        brokenImageUrls,
        hasViewportMeta,
        hasHttps: httpsOk,
        formCount,
        formSubmitAttempted: false,
        consentBannerVisible,
        sslExpiresInDays: sslDays,
      },
    };
  } catch (err) {
    return {
      ok: false,
      finalUrl,
      title,
      findings: sortFindings(findings),
      screenshots,
      metrics: {
        desktopLoadMs,
        mobileLoadMs,
        consoleErrors,
        brokenImages,
        brokenImageUrls,
        hasViewportMeta,
        hasHttps: Boolean(finalUrl?.startsWith("https://")),
        formCount,
        formSubmitAttempted: false,
        consentBannerVisible,
        sslExpiresInDays: sslDays,
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
    await exec("pkill", ["-f", "ms-playwright.*chrome"], {
      timeout: 5000,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}
