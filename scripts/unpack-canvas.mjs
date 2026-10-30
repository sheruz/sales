import fs from "fs";
import zlib from "zlib";
import { inflateRawSync, gunzipSync, inflateSync } from "zlib";

const h = fs.readFileSync(
  "c:/Users/shahroz.hanif/Downloads/Delvix Studio Website.html",
  "utf8"
);

const manMatch = h.match(
  /<script type="__bundler\/manifest">([\s\S]*?)<\/script>/
);
if (!manMatch) {
  console.error("no manifest");
  process.exit(1);
}

let manifest;
try {
  manifest = JSON.parse(manMatch[1]);
} catch (e) {
  console.error("manifest parse fail", e.message);
  // maybe it's not JSON — dump start
  fs.writeFileSync("storage/manifest-raw-start.txt", manMatch[1].slice(0, 2000));
  process.exit(1);
}

console.log("manifest keys", Object.keys(manifest).slice(0, 30));
console.log("entry count", Object.keys(manifest).length);

const sampleKey = Object.keys(manifest)[0];
const sample = manifest[sampleKey];
console.log("sample key", sampleKey);
console.log("sample keys", sample && typeof sample === "object" ? Object.keys(sample) : typeof sample);

fs.mkdirSync("storage/canvas-unpacked", { recursive: true });

function decodeEntry(entry, name) {
  if (!entry) return null;
  if (typeof entry === "string") return entry;
  const { mime, data, compressed, encoding } = entry;
  let buf;
  if (typeof data === "string") {
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
            console.warn("decompress fail", name, e.message);
            return null;
          }
        }
      }
    } else if (encoding === "base64" || /^[A-Za-z0-9+/=\s]+$/.test(data.slice(0, 200))) {
      buf = Buffer.from(data.replace(/\s/g, ""), "base64");
    } else {
      return data;
    }
  } else {
    return null;
  }
  return { mime, buf, text: buf.toString("utf8") };
}

const texts = [];
for (const [key, entry] of Object.entries(manifest)) {
  const decoded = decodeEntry(entry, key);
  if (!decoded) continue;
  if (typeof decoded === "string") {
    if (decoded.includes("We build") || decoded.includes("HOME-01") || decoded.includes("Delvix")) {
      texts.push({ key, preview: decoded.slice(0, 500) });
    }
    continue;
  }
  const { mime, buf, text } = decoded;
  const safe = key.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  if (mime?.includes("html") || mime?.includes("json") || mime?.includes("text") || key.endsWith(".html") || key.endsWith(".json") || key.endsWith(".tsx") || key.endsWith(".jsx") || key.endsWith(".canvas.tsx")) {
    fs.writeFileSync(`storage/canvas-unpacked/${safe}`, buf);
    texts.push({ key, mime, len: buf.length });
  } else if (text.includes("HOME-01") || text.includes("We build the systems") || text.includes("0B1220")) {
    fs.writeFileSync(`storage/canvas-unpacked/${safe}.txt`, buf);
    texts.push({ key, mime, hit: true, len: buf.length });
  }
}

console.log("interesting", texts.length);
console.log(texts.slice(0, 40));

// Also list page order
const orderMatch = h.match(/<script type="__bundler\/page_order">([\s\S]*?)<\/script>/);
if (orderMatch) {
  console.log("page_order", orderMatch[1]);
  fs.writeFileSync("storage/canvas-page-order.txt", orderMatch[1]);
}
