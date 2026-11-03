/**
 * Replace About-page photos with free-licensed Pexels stock
 * (cool / dark tech vibe — matches Delvix navy + indigo theme).
 * Not Revenue OS screenshots. Overwrites existing about-*.webp.
 *
 *   node scripts/fetch-about-images.js
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const OUT = path.join(process.cwd(), "public", "marketing");

/**
 * Pexels (free for commercial use). Cool desks, remote builders, dark UI light —
 * no warm cream / terracotta agency look.
 */
const SLOTS = [
  {
    id: "ABOUT-01",
    w: 1200,
    h: 1500,
    // Software engineer at workstation — portrait crop
    url: "https://images.pexels.com/photos/3861959/pexels-photo-3861959.jpeg?auto=compress&cs=tinysrgb&w=1600&h=2000&fit=crop",
    files: ["about-01.webp", "about-01-founder.webp"],
  },
  {
    id: "ABOUT-02",
    w: 1200,
    h: 900,
    // Dark modern desk / dual monitors
    url: "https://images.pexels.com/photos/1714208/pexels-photo-1714208.jpeg?auto=compress&cs=tinysrgb&w=1600&h=1200&fit=crop",
    files: ["about-02.webp", "about-02-workspace.webp"],
  },
  {
    id: "ABOUT-03",
    w: 1200,
    h: 900,
    // Planning / whiteboard session
    url: "https://images.pexels.com/photos/3183150/pexels-photo-3183150.jpeg?auto=compress&cs=tinysrgb&w=1600&h=1200&fit=crop",
    files: ["about-03.webp", "about-03-whiteboard.webp"],
  },
  {
    id: "ABOUT-04",
    w: 1200,
    h: 900,
    // Small builders collaborating (cool office light)
    url: "https://images.pexels.com/photos/3184292/pexels-photo-3184292.jpeg?auto=compress&cs=tinysrgb&w=1600&h=1200&fit=crop",
    files: ["about-04.webp", "about-04-team.webp"],
  },
];

async function fetchBuffer(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "DelvixStudioMarketingBot/1.0",
      Accept: "image/*",
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Cool / slightly dark grade toward navy marketing chrome. */
async function toThemedWebp(buf, w, h) {
  const navyOverlay = Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0B1220" stop-opacity="0.18"/>
          <stop offset="55%" stop-color="#121A2B" stop-opacity="0.08"/>
          <stop offset="100%" stop-color="#0B1220" stop-opacity="0.28"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
      <rect width="100%" height="100%" fill="#6366F1" fill-opacity="0.04"/>
    </svg>`
  );

  let quality = 80;
  let out = await sharp(buf)
    .resize(w, h, { fit: "cover", position: "attention" })
    .modulate({ brightness: 0.94, saturation: 0.82, hue: -8 })
    .composite([{ input: navyOverlay, blend: "over" }])
    .webp({ quality })
    .toBuffer();

  while (out.length > 250 * 1024 && quality > 40) {
    quality -= 10;
    out = await sharp(buf)
      .resize(w, h, { fit: "cover", position: "attention" })
      .modulate({ brightness: 0.94, saturation: 0.82, hue: -8 })
      .composite([{ input: navyOverlay, blend: "over" }])
      .webp({ quality })
      .toBuffer();
  }
  return { out, quality };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  for (const slot of SLOTS) {
    console.log(`${slot.id}: downloading…`);
    const buf = await fetchBuffer(slot.url);
    const { out, quality } = await toThemedWebp(buf, slot.w, slot.h);
    for (const file of slot.files) {
      const dest = path.join(OUT, file);
      fs.writeFileSync(dest, out);
      console.log(
        `  wrote ${file} (${Math.round(out.length / 1024)}KB q=${quality})`
      );
    }
  }
  console.log("Done. About slots refreshed (Pexels, navy-themed).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
