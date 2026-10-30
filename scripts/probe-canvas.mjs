import fs from "fs";

const h = fs.readFileSync(
  "c:/Users/shahroz.hanif/Downloads/Delvix Studio Website.html",
  "utf8"
);
console.log("len", h.length);
console.log("head", h.slice(0, 400));

const markers = [
  "__bundler",
  "base64",
  "pako",
  "gzip",
  "canvas",
  "HOME-01",
  "We build",
  "Revenue OS",
  "0B1220",
  "6366F1",
  "Plus Jakarta",
];
for (const m of markers) {
  const i = h.indexOf(m);
  console.log(m, i);
  if (i >= 0) console.log("  ctx:", JSON.stringify(h.slice(Math.max(0, i - 40), i + 80)));
}

// Find large base64 blobs
const re = /data:([^;,]+);base64,([A-Za-z0-9+/=\s]{100,})/g;
let match;
let n = 0;
while ((match = re.exec(h)) && n < 5) {
  console.log("data uri", match[1], "b64len", match[2].replace(/\s/g, "").length);
  n++;
}

// Look for script with packed payload
const scripts = [...h.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)];
console.log("scripts", scripts.length);
for (const s of scripts.slice(0, 8)) {
  const attrs = s[1];
  const body = s[2];
  console.log("script attrs", attrs.slice(0, 120), "bodylen", body.length);
}
