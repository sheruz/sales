/**
 * R1 visual QA — screenshots at 1440 & 390, dark & light.
 * Usage: node scripts/r1-screenshots.mjs
 * Requires: app on BASE_URL, seed user admin@salesplatform.local / Admin@123
 */
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { join } from "path";

const BASE = process.env.BASE_URL || "http://127.0.0.1:3000";
const OUT = join(process.cwd(), "docs/design/r1-shots");
mkdirSync(OUT, { recursive: true });

const PAGES = [
  ["/dashboard", "home"],
  ["/dashboard/autopilot", "autopilot"],
  ["/dashboard/companies", "companies"],
  ["/dashboard/contacts", "contacts"],
  ["/dashboard/conversations", "inbox"],
  ["/dashboard/pipeline", "pipeline"],
  ["/dashboard/opportunities", "opportunities"],
  ["/dashboard/meetings", "meetings"],
  ["/dashboard/settings", "settings"],
  ["/dashboard/business-brain", "business-brain"],
  ["/dashboard/icp", "icp"],
  ["/dashboard/services", "services"],
  ["/dashboard/revenue-goals", "revenue-goals"],
  ["/dashboard/sequences", "sequences"],
  ["/dashboard/campaigns", "campaigns"],
  ["/dashboard/proposals", "proposals"],
  ["/login", "login"],
];

const VIEWPORTS = [
  { name: "1440", width: 1440, height: 900 },
  { name: "390", width: 390, height: 844 },
];

async function setTheme(page, theme) {
  await page.evaluate((t) => {
    localStorage.setItem("delvix-theme", t);
    document.documentElement.classList.toggle("dark", t === "dark");
  }, theme);
  await page.reload({ waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(400);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Login
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"], input[name="email"]', "admin@salesplatform.local");
  await page.fill('input[type="password"], input[name="password"]', "Admin@123");
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard|platform/, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(800);

  // If landed on platform, still try dashboard pages
  for (const theme of ["dark", "light"]) {
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      for (const [path, slug] of PAGES) {
        try {
          await page.goto(`${BASE}${path}`, {
            waitUntil: "networkidle",
            timeout: 30000,
          });
          await setTheme(page, theme);
          // Re-apply path after theme reload if needed
          if (!page.url().includes(path.split("?")[0])) {
            await page.goto(`${BASE}${path}`, {
              waitUntil: "networkidle",
              timeout: 30000,
            });
          }
          const file = join(OUT, `${slug}-${vp.name}-${theme}.png`);
          await page.screenshot({ path: file, fullPage: true });
          console.log("ok", file);
        } catch (e) {
          console.error("fail", path, theme, vp.name, e.message);
        }
      }
    }
  }

  await browser.close();
  console.log("done →", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
