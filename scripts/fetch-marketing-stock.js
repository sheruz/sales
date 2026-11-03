/**
 * Fetch stock Unsplash photos → WebP under public/marketing/ for empty industry slots.
 * Idempotent: skips files that already exist.
 *
 *   node scripts/fetch-marketing-stock.js
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const OUT = path.join(process.cwd(), "public", "marketing");

/** Unsplash CDN — no logos; prefer environments over face close-ups. */
const SLOTS = [
  {
    id: "IND-01",
    w: 2400,
    h: 1200,
    // Semi trucks at dusk
    url: "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=2400&h=1200&q=80",
    files: ["ind-01.webp", "ind-01-trucking-hero.webp"],
  },
  {
    id: "HOME-IND-1",
    w: 1200,
    h: 750,
    url: "https://images.unsplash.com/photo-1519003722824-194d4455a60c?auto=format&fit=crop&w=1200&h=750&q=80",
    files: ["home-ind-1.webp", "home-ind-1-trucking.webp"],
  },
  {
    id: "HOME-IND-2",
    w: 1200,
    h: 750,
    url: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&h=750&q=80",
    files: ["home-ind-2.webp", "home-ind-2-real-estate.webp"],
  },
  {
    id: "HOME-IND-3",
    w: 1200,
    h: 750,
    url: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1200&h=750&q=80",
    files: ["home-ind-3.webp", "home-ind-3-clinic.webp"],
  },
  {
    id: "HOME-IND-4",
    w: 1200,
    h: 750,
    url: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1200&h=750&q=80",
    files: ["home-ind-4.webp", "home-ind-4-construction.webp"],
  },
  {
    id: "HOME-IND-5",
    w: 1200,
    h: 750,
    url: "https://images.unsplash.com/photo-1553413077-190dd305871c?auto=format&fit=crop&w=1200&h=750&q=80",
    files: ["home-ind-5.webp", "home-ind-5-retail.webp"],
  },
  {
    id: "HOME-IND-6",
    w: 1200,
    h: 750,
    url: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&h=750&q=80",
    files: ["home-ind-6.webp", "home-ind-6-services.webp"],
  },
  {
    id: "HOME-IND-7",
    w: 1200,
    h: 750,
    url: "https://images.unsplash.com/photo-1501504905252-473c47e087f8?auto=format&fit=crop&w=1200&h=750&q=80",
    files: ["home-ind-7.webp", "home-ind-7-education.webp"],
  },
  {
    id: "HOME-IND-8",
    w: 1200,
    h: 750,
    url: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1200&h=750&q=80",
    files: ["home-ind-8.webp", "home-ind-8-startup.webp"],
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

async function writeWebp(buf, file, w, h) {
  const dest = path.join(OUT, file);
  if (fs.existsSync(dest)) {
    console.log(`  skip ${file}`);
    return;
  }
  let quality = 80;
  let out = await sharp(buf)
    .resize(w, h, { fit: "cover", position: "centre" })
    .webp({ quality })
    .toBuffer();
  while (out.length > 250 * 1024 && quality > 40) {
    quality -= 10;
    out = await sharp(buf)
      .resize(w, h, { fit: "cover", position: "centre" })
      .webp({ quality })
      .toBuffer();
  }
  fs.writeFileSync(dest, out);
  console.log(`  wrote ${file} (${Math.round(out.length / 1024)}KB q=${quality})`);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  for (const slot of SLOTS) {
    const primary = path.join(OUT, slot.files[0]);
    if (slot.files.every((f) => fs.existsSync(path.join(OUT, f)))) {
      console.log(`${slot.id}: already present`);
      continue;
    }
    console.log(`${slot.id}: downloading…`);
    const buf = await fetchBuffer(slot.url);
    for (const file of slot.files) {
      await writeWebp(buf, file, slot.w, slot.h);
    }
    // If primary existed mid-run, still ensure aliases
    if (!fs.existsSync(primary)) {
      throw new Error(`failed to write ${slot.files[0]}`);
    }
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
