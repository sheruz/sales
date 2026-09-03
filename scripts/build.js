/* eslint-disable @typescript-eslint/no-require-imports */
const { execSync } = require("child_process");
const path = require("path");

require("./load-env");

// .env often has NODE_ENV=development — must be production for next build
process.env.NODE_ENV = "production";

const rootDir = path.join(__dirname, "..");

execSync("npx next build", {
  stdio: "inherit",
  cwd: rootDir,
  env: process.env,
  shell: true,
});
