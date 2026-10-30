import fs from "fs";

const html = fs.readFileSync(
  "c:/Users/shahroz.hanif/Downloads/Delvix Studio Website.html",
  "utf8"
);
let t = html
  .replace(/<script[\s\S]*?<\/script>/gi, " ")
  .replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
  .replace(/data:[^"']+/gi, " ")
  .replace(/<[^>]+>/g, "\n")
  .replace(/&nbsp;/g, " ")
  .replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&#\d+;/g, " ")
  .replace(/\n{3,}/g, "\n\n");

const lines = t
  .split(/\n/)
  .map((s) => s.trim())
  .filter((s) => s.length > 2 && s.length < 400);
const uniq = [];
const seen = new Set();
for (const l of lines) {
  if (!seen.has(l)) {
    seen.add(l);
    uniq.push(l);
  }
}
fs.mkdirSync("storage", { recursive: true });
fs.writeFileSync("storage/canvas-copy.txt", uniq.join("\n"));
console.log("lines", uniq.length);

// Also extract slot IDs mentioned
const slots = [...html.matchAll(/\b((?:HOME|SVC|IND|CS|AUDIT|MENU|ABOUT)(?:-IND)?-\d+)\b/g)].map(
  (m) => m[1]
);
console.log("slots", [...new Set(slots)].sort().join(", "));
