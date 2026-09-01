/* eslint-disable @typescript-eslint/no-require-imports */
const { spawnSync } = require("child_process");
const path = require("path");

require("./load-env");

const command = process.argv[2];
const args = process.argv.slice(3);
const rootDir = path.join(__dirname, "..");

if (!command) {
  console.error("Usage: node scripts/run-with-env.js <command> [args...]");
  process.exit(1);
}

const result = spawnSync(command, args, {
  stdio: "inherit",
  cwd: rootDir,
  env: process.env,
  shell: false,
});

process.exit(result.status ?? 1);
