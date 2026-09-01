/* eslint-disable @typescript-eslint/no-require-imports */
const { execSync } = require("child_process");
const path = require("path");

require("./load-env");

const args = process.argv.slice(2).join(" ");
const rootDir = path.join(__dirname, "..");

if (!args) {
  console.error("Usage: node scripts/prisma-cli.js <prisma-command>");
  process.exit(1);
}

execSync(`npx prisma ${args}`, {
  stdio: "inherit",
  cwd: rootDir,
  env: process.env,
});
