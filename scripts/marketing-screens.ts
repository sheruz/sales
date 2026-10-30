/**
 * Full-page marketing screenshots at 375 / 768 / 1440, light + dark.
 * Requires a running server (default http://127.0.0.1:3000).
 *
 *   npx tsx scripts/marketing-screens.ts
 *   BASE_URL=http://127.0.0.1:3000 npx tsx scripts/marketing-screens.ts
 */
import fs from "fs";
import path from "path";
import { chromium, type Browser } from "playwright";

const BASE = process.env.BASE_URL || "http://127.0.0.1:3000";
const OUT = path.join(process.cwd(), "storage", "marketing-screens");
const WIDTHS = [375, 768, 1440] as const;
const PATHS = [
  "/",
  "/services/web-applications",
  "/industries/logistics-trucking",
  "/free-audit",
  "/work/revenue-os",
  "/pricing",
  "/contact",
] as const;

function slug(p: string) {
  return p === "/" ? "home" : p.replace(/^\//, "").replace(/\//g, "__");
}

async function shot(
  browser: Browser,
  route: string,
  width: number,
  colorScheme: "light" | "dark"
) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    colorScheme,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const url = `${BASE}${route}`;
  const res = await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
  if (!res || res.status() >= 400) {
    throw new Error(`Bad status ${res?.status()} for ${url}`);
  }

  // Assert no horizontal overflow
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return {
      scrollWidth: doc.scrollWidth,
      innerWidth: window.innerWidth,
    };
  });
  if (overflow.scrollWidth > overflow.innerWidth + 1) {
    throw new Error(
      `Horizontal scroll on ${route} @${width}px ${colorScheme}: scrollWidth=${overflow.scrollWidth} innerWidth=${overflow.innerWidth}`
    );
  }

  // Placeholder text must not appear in visible body
  const banned = await page.evaluate(() => {
    const text = document.body?.innerText || "";
    const hits: string[] = [];
    for (const w of ["placeholder", "Replace with", "TODO", "lorem"]) {
      if (new RegExp(w, "i").test(text)) hits.push(w);
    }
    return hits;
  });
  if (banned.length) {
    throw new Error(`Banned text on ${route}: ${banned.join(", ")}`);
  }

  const dir = path.join(OUT, `${width}`, colorScheme);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${slug(route)}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log("wrote", path.relative(process.cwd(), file));
  await context.close();
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of WIDTHS) {
      for (const scheme of ["light", "dark"] as const) {
        for (const route of PATHS) {
          await shot(browser, route, width, scheme);
        }
      }
    }
  } finally {
    await browser.close();
  }
  console.log("\nScreenshots saved under storage/marketing-screens/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
