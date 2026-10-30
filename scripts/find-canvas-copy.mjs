import fs from "fs";
import path from "path";

const root = "storage/canvas-boards";
const needles = [
  "HOME-01",
  "We build the systems",
  "Written scope in 3 days",
  "renderVals",
  "0B1220",
  "6366F1",
  "Book a free call",
  "dx-float",
  "Plus Jakarta",
  "FOUNDER QUOTE",
  "Revenue OS",
  "Logistics",
];

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else {
      const buf = fs.readFileSync(p);
      // skip obvious binary images
      if (buf[0] === 0x89 && buf[1] === 0x50) continue; // png
      if (buf[0] === 0xff && buf[1] === 0xd8) continue; // jpg
      if (buf.toString("utf8", 0, 4) === "wOF2" || buf.toString("utf8", 0, 4) === "OTTO") continue;
      const text = buf.toString("utf8");
      for (const n of needles) {
        const i = text.indexOf(n);
        if (i >= 0) {
          console.log("HIT", n, "in", p, "at", i, "size", buf.length);
          console.log("  ", JSON.stringify(text.slice(Math.max(0, i - 60), i + 120)));
        }
      }
    }
  }
}

walk(root);
