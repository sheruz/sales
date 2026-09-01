/* eslint-disable @typescript-eslint/no-require-imports */
const { execSync } = require("child_process");
const path = require("path");
const { ensureDatabaseUrl } = require("./database-url");

const rootDir = path.join(__dirname, "..");

require("dotenv").config({ path: path.join(rootDir, ".env") });
ensureDatabaseUrl();

console.log("[postinstall] Generating Prisma client...");
try {
  execSync("npx prisma generate", {
    stdio: "inherit",
    cwd: rootDir,
    env: process.env,
  });
} catch (error) {
  console.warn(
    "[postinstall] Prisma generate failed, will retry at build time.",
    error.message
  );
}

require("./ensure-tailwind-oxide.js");
