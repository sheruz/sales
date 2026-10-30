import fs from "fs";
import path from "path";
import { gunzipSync, inflateSync, inflateRawSync } from "zlib";

// Re-read home board HTML and dump template + look for any other script types
const homeId = "6d510255-af8a-4cb2-8e81-4ab59efe6123";
const html = fs.readFileSync(`storage/canvas-unpacked/${homeId}`, "utf8");

const types = [...html.matchAll(/<script type="([^"]+)">/g)].map((m) => m[1]);
console.log("script types", types);

for (const t of [
  "__bundler/template",
  "__bundler/ext_resources",
  "__bundler/page_order",
]) {
  const m = html.match(new RegExp(`<script type="${t}">([\\s\\S]*?)</script>`));
  if (m) {
    console.log("\n===", t, "len", m[1].length);
    console.log(m[1].slice(0, 2000));
    fs.writeFileSync(`storage/home-${t.replace("/", "-")}.txt`, m[1]);
  }
}

// Search all home board files for distinctive strings as binary
const dir = "storage/canvas-boards/home";
const needles = Buffer.from("HOME-01");
const needles2 = Buffer.from("We build the systems");
const needles3 = Buffer.from("img-slot");
const needles4 = Buffer.from("dc-import");
const needles5 = Buffer.from("Floating");
const needles6 = Buffer.from("marquee");

for (const f of fs.readdirSync(dir)) {
  const buf = fs.readFileSync(path.join(dir, f));
  for (const [label, n] of [
    ["HOME-01", needles],
    ["We build", needles2],
    ["img-slot", needles3],
    ["dc-import", needles4],
    ["Floating", needles5],
    ["marquee", needles6],
  ]) {
    const i = buf.indexOf(n);
    if (i >= 0) console.log("BIN HIT", label, f, i);
  }
}

// Check if 131KB "js" is actually something else / has unicode escaped copy
const big = fs.readFileSync(path.join(dir, "09ff51e2-7358-4fa6-a3d0-e870cf4cf044.js"));
console.log("\nbig head", big.slice(0, 200).toString("utf8"));
console.log("big has HOME", big.includes("HOME"));
console.log("big has build", big.toString("utf8").includes("build"));

// Maybe the main page is still compressed inside manifest with wrong decode?
// Re-decode ALL home nested entries and look for HTML with Home title
const man = JSON.parse(
  html.match(/<script type="__bundler\/manifest">([\s\S]*?)<\/script>/)[1]
);

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

for (const [key, entry] of Object.entries(man)) {
  const buf = decode(entry);
  const head = buf.slice(0, 120).toString("utf8");
  const title = buf.toString("utf8").match(/<title>([^<]+)<\/title>/)?.[1];
  console.log(key.slice(0, 8), entry.mime, buf.length, "title=", title, "head=", JSON.stringify(head.slice(0, 80)));
  if (title && title.includes("Home") && !title.includes("Header")) {
    fs.writeFileSync("storage/canvas-pages/home-main.html", buf);
    console.log("SAVED HOME MAIN");
  }
  // Also save any html that isn't header/footer
  if (
    entry.mime === "text/html" &&
    title &&
    !title.includes("Header") &&
    !title.includes("Footer")
  ) {
    fs.writeFileSync(`storage/canvas-pages/${title.replace(/[^a-z0-9]+/gi, "-")}.html`, buf);
    console.log("SAVED", title);
  }
}
