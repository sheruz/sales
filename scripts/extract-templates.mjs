import fs from "fs";
import path from "path";
import { gunzipSync, inflateSync, inflateRawSync } from "zlib";

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

fs.mkdirSync("storage/canvas-pages", { recursive: true });

function decode(entry) {
  const raw = Buffer.from(entry.data, "base64");
  if (!entry.compressed) return raw;
  try {
    return gunzipSync(raw);
  } catch {
    try {
      return inflateSync(raw);
    } catch {
      return inflateRawSync(raw);
    }
  }
}

const allCopy = [];

for (let i = 0; i < order.length; i++) {
  const id = order[i];
  const name = names[i];
  // For nested boards, the board file itself is the nested HTML with its own template
  const boardPath = `storage/canvas-unpacked/${id}`;
  const boardHtml = fs.readFileSync(boardPath, "utf8");
  const tmplMatch = boardHtml.match(
    /<script type="__bundler\/template">([\s\S]*?)<\/script>/
  );
  if (!tmplMatch) {
    console.log(name, "NO TEMPLATE");
    continue;
  }
  let html;
  try {
    html = JSON.parse(tmplMatch[1]);
  } catch (e) {
    console.log(name, "template parse fail", e.message);
    continue;
  }
  fs.writeFileSync(`storage/canvas-pages/${name}.html`, html);
  console.log(name, "html bytes", html.length);

  // Extract text for content file
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "\n")
    .replace(/<style[\s\S]*?<\/style>/gi, "\n")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h[1-6]|li|div|button|a|td|th|label|strong)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .split(/\n/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length > 1 && s.length < 400);

  const uniq = [];
  const seen = new Set();
  for (const l of text) {
    if (seen.has(l)) continue;
    seen.add(l);
    uniq.push(l);
  }

  // Also extract renderVals JS
  const scriptMatch = html.match(
    /<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/
  );
  let vals = "";
  if (scriptMatch) vals = scriptMatch[1];

  allCopy.push(`\n========== ${name} ==========\n` + uniq.join("\n"));
  if (vals) {
    fs.writeFileSync(`storage/canvas-pages/${name}.logic.js`, vals);
    allCopy.push("\n--- renderVals ---\n" + vals);
  }
}

fs.writeFileSync("storage/canvas-copy-exact.txt", allCopy.join("\n"));
console.log("done");
