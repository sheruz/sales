/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");

const rootDir = path.join(__dirname, "..");
const standaloneDir = path.join(rootDir, ".next", "standalone");

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`[post-build] Skip missing: ${src}`);
    return;
  }

  fs.mkdirSync(dest, { recursive: true });

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

if (!fs.existsSync(standaloneDir)) {
  console.log("[post-build] No standalone output, skipping asset copy.");
  process.exit(0);
}

console.log("[post-build] Copying static assets for standalone...");

copyDir(
  path.join(rootDir, ".next", "static"),
  path.join(standaloneDir, ".next", "static")
);

copyDir(path.join(rootDir, "public"), path.join(standaloneDir, "public"));

console.log("[post-build] Standalone assets ready.");
