/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Replace "/dashboard..." and "/platform..." with appHome()/appOps().
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "src");
const SKIP = new Set([
  path.join(ROOT, "lib", "app-paths.ts"),
  path.join(ROOT, "middleware.ts"),
]);

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(name)) out.push(p);
  }
  return out;
}

function ensureImport(src) {
  if (
    src.includes('from "@/lib/app-paths"') ||
    src.includes("from '@/lib/app-paths'")
  ) {
    // Ensure both symbols if needed
    if (src.includes("appHome(") && !src.includes("appHome")) {
      /* noop */
    }
    if (
      (src.includes("appHome(") || src.includes("appOps(")) &&
      src.includes("@/lib/app-paths")
    ) {
      // Expand import if only one named
      src = src.replace(
        /import\s*\{\s*([^}]+)\s*\}\s*from\s*["']@\/lib\/app-paths["']\s*;?/,
        (m, names) => {
          const set = new Set(
            names.split(",").map((s) => s.trim()).filter(Boolean)
          );
          if (src.includes("appHome(")) set.add("appHome");
          if (src.includes("appOps(")) set.add("appOps");
          return `import { ${[...set].join(", ")} } from "@/lib/app-paths";`;
        }
      );
    }
    return src;
  }
  if (!src.includes("appHome(") && !src.includes("appOps(")) return src;

  const names = [];
  if (src.includes("appHome(")) names.push("appHome");
  if (src.includes("appOps(")) names.push("appOps");
  const importLine = `import { ${names.join(", ")} } from "@/lib/app-paths";\n`;
  if (/^["']use client["'];?\r?\n/.test(src)) {
    return src.replace(/^(["']use client["'];?\r?\n)/, `$1${importLine}`);
  }
  if (/^["']use server["'];?\r?\n/.test(src)) {
    return src.replace(/^(["']use server["'];?\r?\n)/, `$1${importLine}`);
  }
  return importLine + src;
}

function isApiPlatform(full, offset) {
  return full.slice(Math.max(0, offset - 5), offset).includes("/api");
}

function transform(src) {
  let out = src;

  // Template literals with /dashboard
  out = out.replace(/`\/dashboard(\/[^`]*)`/g, (_, rest) =>
    rest.includes("${") ? `appHome(\`${rest}\`)` : `appHome("${rest}")`
  );
  out = out.replace(/`\/dashboard`/g, "appHome()");

  // Quoted /dashboard/path
  out = out.replace(/(["'])\/dashboard(\/[^"']*)\1/g, (_, q, rest) => {
    return `appHome(${q}${rest}${q})`;
  });
  // Quoted exact /dashboard
  out = out.replace(/(["'])\/dashboard\1/g, "appHome()");

  // Template /platform
  out = out.replace(/`\/platform(\/[^`]*)`/g, (m, rest, offset) => {
    if (isApiPlatform(out, offset)) return m;
    return rest.includes("${") ? `appOps(\`${rest}\`)` : `appOps("${rest}")`;
  });
  out = out.replace(/`\/platform`/g, (m, offset) => {
    if (isApiPlatform(out, offset)) return m;
    return "appOps()";
  });

  out = out.replace(/(["'])\/platform(\/[^"']*)\1/g, (m, q, rest, offset) => {
    if (isApiPlatform(out, offset)) return m;
    return `appOps(${q}${rest}${q})`;
  });
  out = out.replace(/(["'])\/platform\1/g, (m, q, offset) => {
    if (isApiPlatform(out, offset)) return m;
    return "appOps()";
  });

  // JSX attrs: href=appHome(...) → href={appHome(...)}
  out = out.replace(
    /\b(href|to|action|as)=app(Home|Ops)\(/g,
    "$1={app$2("
  );

  return out;
}

let changed = 0;
for (const file of walk(ROOT)) {
  if (SKIP.has(file)) continue;
  const raw = fs.readFileSync(file, "utf8");
  let next = transform(raw);
  if (next === raw) continue;
  next = ensureImport(next);
  fs.writeFileSync(file, next);
  changed++;
  console.log("updated", path.relative(path.join(ROOT, ".."), file));
}
console.log(JSON.stringify({ changed }, null, 2));
