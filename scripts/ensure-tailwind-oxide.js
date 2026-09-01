/* eslint-disable @typescript-eslint/no-require-imports */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const OXIDE_VERSION = "4.3.3";

const PLATFORM_PACKAGES = {
  "linux-x64": "@tailwindcss/oxide-linux-x64-gnu",
  "linux-arm64": "@tailwindcss/oxide-linux-arm64-gnu",
  "win32-x64": "@tailwindcss/oxide-win32-x64-msvc",
  "win32-arm64": "@tailwindcss/oxide-win32-arm64-msvc",
  "darwin-x64": "@tailwindcss/oxide-darwin-x64",
  "darwin-arm64": "@tailwindcss/oxide-darwin-arm64",
};

const rootDir = path.join(__dirname, "..");
const key = `${process.platform}-${process.arch}`;
const pkg = PLATFORM_PACKAGES[key];

if (!pkg) {
  console.warn(`[tailwind-oxide] No native binding mapped for ${key}`);
  process.exit(0);
}

const pkgDir = path.join(rootDir, "node_modules", pkg);

if (fs.existsSync(pkgDir)) {
  process.exit(0);
}

console.log(`[tailwind-oxide] Installing missing native binding: ${pkg}@${OXIDE_VERSION}`);

try {
  execSync(`npm install ${pkg}@${OXIDE_VERSION} --no-save --include=optional`, {
    stdio: "inherit",
    cwd: rootDir,
  });
  console.log(`[tailwind-oxide] Installed ${pkg}`);
} catch (error) {
  console.error(`[tailwind-oxide] Failed to install ${pkg}:`, error.message);
  process.exit(1);
}
