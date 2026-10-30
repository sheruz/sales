import fs from "fs";
import path from "path";

const root = "storage/canvas-boards";

function sniff(buf) {
  const head = buf.slice(0, 200).toString("utf8");
  if (head.includes("<!doctype") || head.includes("<html") || head.includes("<x-dc")) return "html";
  if (head.includes("function") || head.includes("const ") || head.startsWith("(function")) return "js";
  if (head.includes("{") && (head.includes('"mime"') || head.includes("renderVals"))) return "jsonish";
  if (buf[0] === 0x89 && buf[1] === 0x50) return "png";
  if (head.startsWith("wOF2") || head.startsWith("OTTO") || head.includes("ftyp")) return "font/media";
  return "unknown";
}

for (const board of fs.readdirSync(root)) {
  const dir = path.join(root, board);
  if (!fs.statSync(dir).isDirectory()) continue;
  console.log("\n##", board);
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const buf = fs.readFileSync(p);
    const kind = sniff(buf);
    console.log(f.slice(0, 8), kind, buf.length);
    if (kind === "html" || (kind === "js" && buf.length < 200000 && buf.toString("utf8").includes("renderVals"))) {
      const text = buf.toString("utf8");
      // extract title
      const title = text.match(/<title>([^<]+)<\/title>/)?.[1];
      const hasHome = text.includes("HOME-01") || text.includes("We build the systems");
      console.log("  title:", title, "homeish:", hasHome);
      if (hasHome || (title && !title.includes("Header") && !title.includes("Footer"))) {
        const out = path.join("storage/canvas-pages", `${board}.html`);
        fs.mkdirSync("storage/canvas-pages", { recursive: true });
        fs.writeFileSync(out, buf);
        console.log("  SAVED", out);
      }
    }
  }
}

// Also dig into the big JS for embedded HTML strings containing HOME-01
for (const board of ["home", "mega-menu", "service-web", "industry-logistics", "case-revenue-os", "free-audit", "about", "pricing", "contact"]) {
  const dir = path.join(root, board);
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".js") && !f.endsWith(".bin")) continue;
    const text = fs.readFileSync(path.join(dir, f), "utf8");
    if (text.includes("HOME-01") || text.includes("We build the systems your business") || text.includes("img-slot") || text.includes("IMAGE SLOT")) {
      console.log("EMBED in", board, f);
      // try to extract large HTML-like substring
      const idx = text.indexOf("<x-dc>");
      if (idx >= 0) {
        const end = text.indexOf("</x-dc>", idx);
        if (end > idx) {
          fs.mkdirSync("storage/canvas-pages", { recursive: true });
          fs.writeFileSync(`storage/canvas-pages/${board}-embed.html`, text.slice(idx, end + 7));
          console.log("  extracted x-dc", end - idx);
        }
      }
    }
  }
}
