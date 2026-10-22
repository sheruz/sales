/**
 * pm2 entry: sales-audit-worker
 * Usage:
 *   PLAYWRIGHT_BROWSERS_PATH=0 pm2 start scripts/audit-worker.js --name sales-audit-worker
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const { spawn } = require("child_process");
const path = require("path");

require("./load-env");

const rootDir = path.join(__dirname, "..");

// Project-local Playwright browsers only (does not touch system Chrome / other apps)
if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = "0";
}

const child = spawn(
  "npx",
  ["tsx", "src/workers/audit-worker.ts"],
  {
    cwd: rootDir,
    stdio: "inherit",
    env: process.env,
    shell: true,
  }
);

child.on("exit", (code) => process.exit(code ?? 0));

process.on("SIGINT", () => {
  child.kill("SIGINT");
});
process.on("SIGTERM", () => {
  child.kill("SIGTERM");
});
