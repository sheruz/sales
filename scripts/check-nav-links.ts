/**
 * Crawl every href in the marketing navigation and fail on non-200 responses.
 *
 * Usage:
 *   npm run check:nav
 *   BASE_URL=https://delvixstudio.com npm run check:nav
 *
 * Redirects are NOT followed: a nav link that redirects should be updated to
 * point at its final destination.
 */
import { getAllNavHrefs } from "../src/content/navigation";

const BASE_URL = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");

async function check(href: string): Promise<{ href: string; ok: boolean; note: string }> {
  // External links (e.g. the booking URL) are not part of this site; skip them.
  if (/^https?:\/\//i.test(href)) return { href, ok: true, note: "skip" };
  try {
    const res = await fetch(`${BASE_URL}${href}`, { redirect: "manual" });
    if (res.status === 200) return { href, ok: true, note: "200" };
    const location = res.headers.get("location");
    return {
      href,
      ok: false,
      note: `${res.status}${location ? ` -> ${location}` : ""}`,
    };
  } catch (err) {
    return {
      href,
      ok: false,
      note: err instanceof Error ? err.message : String(err),
    };
  }
}

async function main() {
  const hrefs = getAllNavHrefs();
  console.log(`Checking ${hrefs.length} nav links against ${BASE_URL}\n`);

  const results = [];
  for (const href of hrefs) {
    const r = await check(href);
    results.push(r);
    console.log(`${r.ok ? "OK  " : "FAIL"} ${r.note.padEnd(4)} ${href}`);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length > 0) {
    console.error(`\n${failed.length} link(s) failed:`);
    for (const f of failed) console.error(`  ${f.href}  (${f.note})`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
