import fs from "fs";
import path from "path";
import { gunzipSync, inflateSync, inflateRawSync } from "zlib";

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

function decodeEntry(entry, name) {
  if (!entry || typeof entry !== "object") return null;
  const { mime, data, compressed } = entry;
  if (typeof data !== "string") return null;
  let buf;
  if (compressed) {
    const raw = Buffer.from(data, "base64");
    try {
      buf = gunzipSync(raw);
    } catch {
      try {
        buf = inflateSync(raw);
      } catch {
        try {
          buf = inflateRawSync(raw);
        } catch (e) {
          console.warn("fail", name, e.message);
          return null;
        }
      }
    }
  } else {
    buf = Buffer.from(data.replace(/\s/g, ""), "base64");
  }
  return { mime, buf };
}

const allText = [];

for (let i = 0; i < order.length; i++) {
  const id = order[i];
  const name = names[i];
  const html = fs.readFileSync(path.join(dir, id), "utf8");
  const manMatch = html.match(
    /<script type="__bundler\/manifest">([\s\S]*?)<\/script>/
  );
  console.log("\n===", name, "===");
  if (!manMatch) {
    // Maybe the content is inline differently
    console.log("no nested manifest; sniffing...");
    const hits = ["HOME-01", "We build", "0B1220", "renderVals", "sc-for", "dx-float"];
    for (const h of hits) console.log(h, html.indexOf(h));
    // dump unique script types
    const types = [...html.matchAll(/type="([^"]+)"/g)].map((m) => m[1]);
    console.log("types", [...new Set(types)].slice(0, 20));
    continue;
  }

  let manifest;
  try {
    manifest = JSON.parse(manMatch[1]);
  } catch (e) {
    console.log("parse fail", e.message, "len", manMatch[1].length);
    continue;
  }

  console.log("nested entries", Object.keys(manifest).length);
  const outDir = path.join("storage/canvas-boards", name);
  fs.mkdirSync(outDir, { recursive: true });

  for (const [key, entry] of Object.entries(manifest)) {
    const decoded = decodeEntry(entry, key);
    if (!decoded) continue;
    const safe = key.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
    const ext =
      decoded.mime?.includes("javascript") || key.endsWith(".js")
        ? ".js"
        : decoded.mime?.includes("css")
          ? ".css"
          : decoded.mime?.includes("html")
            ? ".html"
            : decoded.mime?.includes("json")
              ? ".json"
              : decoded.mime?.includes("svg")
                ? ".svg"
                : ".bin";
    fs.writeFileSync(path.join(outDir, safe + ext), decoded.buf);

    // If text-like, search for marketing copy
    if (ext === ".js" || ext === ".html" || ext === ".json" || ext === ".css") {
      const t = decoded.buf.toString("utf8");
      if (
        t.includes("We build") ||
        t.includes("HOME-01") ||
        t.includes("renderVals") ||
        t.includes("Written scope") ||
        t.includes("Revenue OS")
      ) {
        console.log("HIT", key, ext, decoded.buf.length);
        // extract string literals that look like copy
        const strings = [];
        for (const m of t.matchAll(/["'`]([^"'`]{12,220})["'`]/g)) {
          const s = m[1];
          if (/^[a-z0-9_./\\-]+$/i.test(s)) continue;
          if (s.includes("function") || s.includes("=>")) continue;
          if (s.includes("http") && s.length > 60) continue;
          if (/[{};=]/.test(s) && s.length > 40) continue;
          strings.push(s);
        }
        const uniq = [...new Set(strings)].slice(0, 400);
        allText.push(`\n===== ${name} / ${key} =====\n` + uniq.join("\n"));
      }
    }
  }
}

fs.writeFileSync("storage/canvas-copy-exact.txt", allText.join("\n"));
console.log("\nwrote canvas-copy-exact.txt", allText.length, "sections");
