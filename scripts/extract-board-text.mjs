import fs from "fs";
import path from "path";

const dir = "storage/canvas-unpacked";
const order = JSON.parse(fs.readFileSync("storage/canvas-page-order.txt", "utf8"));
const names = [
  "home",
  "header",
  "footer",
  "mega-menu",
  "service-web",
  "industry-logistics",
  "case-revenue-os",
  "free-audit",
  "about",
  "pricing",
  "contact",
];

const out = [];

for (let i = 0; i < order.length; i++) {
  const id = order[i];
  const file = path.join(dir, id);
  if (!fs.existsSync(file)) {
    out.push(`\n===== ${names[i] || i} MISSING ${id} =====\n`);
    continue;
  }
  let html = fs.readFileSync(file, "utf8");
  // Prefer visible text nodes; strip scripts/styles/svg
  html = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ");

  // Pull data-label / aria / title attributes that might hold copy
  const attrs = [];
  for (const m of html.matchAll(
    /(?:aria-label|title|data-label|alt|placeholder)=["']([^"']{3,200})["']/gi
  )) {
    attrs.push(m[1]);
  }

  // Also extract text between tags
  const lines = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h[1-6]|li|div|span|button|a|td|th|label)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, " ")
    .split(/\n/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length > 1 && s.length < 500);

  const uniq = [];
  const seen = new Set();
  for (const l of [...attrs, ...lines]) {
    const key = l.toLowerCase();
    if (seen.has(key)) continue;
    // skip CSS-ish / uuid / noise
    if (/^[0-9a-f-]{20,}$/i.test(l)) continue;
    if (/^(rgb|hsl|#|px|rem|em|var\()/i.test(l)) continue;
    if (l.includes("{") && l.includes("}")) continue;
    if (l.startsWith("http") && l.length > 80) continue;
    seen.add(key);
    uniq.push(l);
  }

  out.push(`\n========== ${names[i] || i} (${id}) ==========\n`);
  out.push(uniq.join("\n"));
  console.log(names[i], "lines", uniq.length, "fileKB", Math.round(fs.statSync(file).size / 1024));
}

fs.writeFileSync("storage/canvas-boards-text.txt", out.join("\n"));
console.log("wrote storage/canvas-boards-text.txt");
