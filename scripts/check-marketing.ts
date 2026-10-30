/**
 * Fails the build if marketing pages contain banned copy or missing image assets.
 * Run: npx tsx scripts/check-marketing.ts
 */
import fs from "fs";
import path from "path";

const ROOT = path.join(process.cwd());
const SITE = path.join(ROOT, "src", "app", "(site)");
const COMPONENTS = path.join(ROOT, "src", "components", "marketing");
const CONTENT = path.join(ROOT, "src", "content");
const PUBLIC = path.join(ROOT, "public");

const BANNED =
  /\b(placeholder|Replace with|TODO|lorem)\b/i;

const SRC_RE =
  /(?:src|href)=["'`](\/marketing\/[^"'`]+)["'`]|illustrationSrc\(["'`]([^"'`]+)["'`]\)|name=["'`](revenue-os-[^"'`]+)["'`]/g;

function walk(dir: string, exts: Set<string>, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, exts, out);
    else if (exts.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

function fail(msg: string) {
  console.error(`✗ ${msg}`);
  process.exitCode = 1;
}

function ok(msg: string) {
  console.log(`✓ ${msg}`);
}

const textFiles = [
  ...walk(SITE, new Set([".tsx", ".ts"])),
  ...walk(COMPONENTS, new Set([".tsx", ".ts"])),
  ...walk(CONTENT, new Set([".tsx", ".ts"])),
  ...walk(path.join(PUBLIC, "marketing"), new Set([".svg"])),
];

let bannedHits = 0;
for (const file of textFiles) {
  const rel = path.relative(ROOT, file);
  // Form input placeholders are fine (HTML attribute), skip those lines.
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, i) => {
    // HTML/JSX input placeholders and form field config keys are fine.
    if (/placeholder\s*[=?:]/.test(line)) return;
    if (BANNED.test(line)) {
      if (rel.includes(`${path.sep}screens${path.sep}README`)) return;
      if (rel.replace(/\\/g, "/").includes("scripts/check-marketing")) return;
      if (rel.replace(/\\/g, "/").includes("scripts/marketing-screens")) return;
      fail(`${rel}:${i + 1} banned text → ${line.trim().slice(0, 120)}`);
      bannedHits++;
    }
  });
}
if (bannedHits === 0) ok("No banned marketing copy (placeholder / Replace with / TODO / lorem)");

const assetRefs = new Set<string>();
for (const file of textFiles) {
  const text = fs.readFileSync(file, "utf8");
  let m: RegExpExecArray | null;
  const re = new RegExp(SRC_RE.source, "g");
  while ((m = re.exec(text))) {
    if (m[1]) assetRefs.add(m[1].split("?")[0]);
    if (m[2]) assetRefs.add(`/marketing/illustrations/${m[2]}.svg`);
  }
}

// Known ProductShot fallbacks + illustrations keys from page-visuals
const visualsFile = path.join(ROOT, "src", "lib", "marketing", "page-visuals.ts");
const visualsText = fs.readFileSync(visualsFile, "utf8");
const keyRe = /\| "([a-z0-9-]+)"/g;
let km: RegExpExecArray | null;
while ((km = keyRe.exec(visualsText))) {
  assetRefs.add(`/marketing/illustrations/${km[1]}.svg`);
}

assetRefs.add("/marketing/screenshots/revenue-os-dashboard.svg");
assetRefs.add("/marketing/screenshots/revenue-os-audit.svg");
assetRefs.add("/marketing/screenshots/revenue-os-packages.svg");
assetRefs.add("/marketing/screenshots/revenue-os-pipeline.svg");

let missing = 0;
for (const ref of [...assetRefs].sort()) {
  if (!ref.startsWith("/marketing/")) continue;
  // PNG screens are optional until the user drops them in
  if (ref.startsWith("/marketing/screens/") && ref.endsWith(".png")) continue;
  const abs = path.join(PUBLIC, ref.replace(/^\//, ""));
  if (!fs.existsSync(abs)) {
    fail(`Missing asset ${ref}`);
    missing++;
  }
}
if (missing === 0) ok(`All ${assetRefs.size} marketing asset refs resolve (PNG screens optional)`);

if (process.exitCode) {
  console.error("\ncheck-marketing failed.");
  process.exit(1);
}
console.log("\ncheck-marketing passed.");
