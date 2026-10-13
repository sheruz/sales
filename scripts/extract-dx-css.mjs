import fs from "fs";

const html = fs.readFileSync(
  "c:/Users/shahroz.hanif/Downloads/delvix-redesign-kit/delvix-app-reference.html",
  "utf8",
);
const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];

// Keep only component rules (from .btn) — shell is handled by our layout
const start = css.indexOf(".btn{");
const components = css.slice(start, css.indexOf("/* ============ RESPONSIVE"));

function prefixSelector(sel) {
  const s = sel.trim();
  if (!s) return s;
  if (s.startsWith("@")) return s;
  if (s.includes(".dx ")) return s;
  return `.dx ${s}`;
}

const out = [];
let i = 0;
while (i < components.length) {
  // skip comments
  if (components.startsWith("/*", i)) {
    const end = components.indexOf("*/", i);
    i = end < 0 ? components.length : end + 2;
    continue;
  }
  const brace = components.indexOf("{", i);
  if (brace < 0) break;
  const sel = components.slice(i, brace).trim();
  let depth = 0;
  let j = brace;
  for (; j < components.length; j++) {
    if (components[j] === "{") depth++;
    else if (components[j] === "}") {
      depth--;
      if (depth === 0) {
        j++;
        break;
      }
    }
  }
  const body = components.slice(brace, j);
  if (sel.startsWith("@media")) {
    // prefix nested selectors inside media
    const inner = body.slice(1, -1);
    const nested = [];
    let k = 0;
    while (k < inner.length) {
      if (inner.startsWith("/*", k)) {
        const e = inner.indexOf("*/", k);
        k = e < 0 ? inner.length : e + 2;
        continue;
      }
      const b = inner.indexOf("{", k);
      if (b < 0) break;
      const ns = inner.slice(k, b).trim();
      let d = 0;
      let m = b;
      for (; m < inner.length; m++) {
        if (inner[m] === "{") d++;
        else if (inner[m] === "}") {
          d--;
          if (d === 0) {
            m++;
            break;
          }
        }
      }
      const nb = inner.slice(b, m);
      nested.push(
        ns
          .split(",")
          .map((x) => prefixSelector(x))
          .join(", ") + nb,
      );
      k = m;
    }
    out.push(`${sel}{\n${nested.join("\n")}\n}`);
  } else {
    const prefixed = sel
      .split(",")
      .map((x) => prefixSelector(x))
      .join(", ");
    out.push(prefixed + body);
  }
  i = j;
}

const header = `/* Delvix R2 — reference page components scoped under .dx */
.dx {
  --dx-surface: var(--card);
  --dx-surface-2: var(--muted);
  --dx-surface-3: var(--secondary);
  --dx-border: var(--border);
  --dx-border-strong: color-mix(in srgb, var(--border) 70%, var(--foreground));
  --dx-text: var(--foreground);
  --dx-text-2: var(--muted-foreground);
  --dx-text-3: color-mix(in srgb, var(--muted-foreground) 75%, transparent);
  --dx-brand: var(--primary);
  --dx-brand-hover: color-mix(in srgb, var(--primary) 85%, white);
  --dx-brand-soft: color-mix(in srgb, var(--primary) 14%, transparent);
  --dx-accent: #ff6b3d;
  --dx-ok: var(--success);
  --dx-ok-soft: color-mix(in srgb, var(--success) 12%, transparent);
  --dx-warn: var(--warning);
  --dx-warn-soft: color-mix(in srgb, var(--warning) 12%, transparent);
  --dx-bad: var(--destructive);
  --dx-bad-soft: color-mix(in srgb, var(--destructive) 12%, transparent);
  --dx-info: var(--info);
  --dx-info-soft: color-mix(in srgb, var(--info) 12%, transparent);
  --dx-neutral-soft: color-mix(in srgb, var(--muted-foreground) 12%, transparent);
  --dx-radius: 12px;
  --dx-radius-sm: 8px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--dx-text);
}
.dx a { color: inherit; text-decoration: none; }
`;

// Map var(--*) used in reference to our --dx-* where needed
let mapped = out
  .join("\n")
  .replace(/var\(--surface-3\)/g, "var(--dx-surface-3)")
  .replace(/var\(--surface-2\)/g, "var(--dx-surface-2)")
  .replace(/var\(--surface\)/g, "var(--dx-surface)")
  .replace(/var\(--border-strong\)/g, "var(--dx-border-strong)")
  .replace(/var\(--border\)/g, "var(--dx-border)")
  .replace(/var\(--text-3\)/g, "var(--dx-text-3)")
  .replace(/var\(--text-2\)/g, "var(--dx-text-2)")
  .replace(/var\(--text\)/g, "var(--dx-text)")
  .replace(/var\(--brand-hover\)/g, "var(--dx-brand-hover)")
  .replace(/var\(--brand-soft\)/g, "var(--dx-brand-soft)")
  .replace(/var\(--brand\)/g, "var(--dx-brand)")
  .replace(/var\(--accent\)/g, "var(--dx-accent)")
  .replace(/var\(--ok-soft\)/g, "var(--dx-ok-soft)")
  .replace(/var\(--ok\)/g, "var(--dx-ok)")
  .replace(/var\(--warn-soft\)/g, "var(--dx-warn-soft)")
  .replace(/var\(--warn\)/g, "var(--dx-warn)")
  .replace(/var\(--bad-soft\)/g, "var(--dx-bad-soft)")
  .replace(/var\(--bad\)/g, "var(--dx-bad)")
  .replace(/var\(--info-soft\)/g, "var(--dx-info-soft)")
  .replace(/var\(--info\)/g, "var(--dx-info)")
  .replace(/var\(--neutral-soft\)/g, "var(--dx-neutral-soft)")
  .replace(/var\(--radius-sm\)/g, "var(--dx-radius-sm)")
  .replace(/var\(--radius\)/g, "var(--dx-radius)");

fs.writeFileSync(
  "d:/Internal Shahroz/sales-platform/src/app/dx-reference.css",
  header + mapped + "\n",
);
console.log("ok", mapped.length);
