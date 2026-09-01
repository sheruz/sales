/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const { ensureDatabaseUrl } = require("./database-url");

const rootDir = path.join(__dirname, "..");
const envPath = path.join(rootDir, ".env");

if (fs.existsSync(envPath)) {
  require("dotenv").config({ path: envPath });
} else {
  console.warn("[env] No .env file found at", envPath);
}

const databaseUrl = ensureDatabaseUrl();
console.log("[env] Using database:", databaseUrl.replace(/:([^:@/]+)@/, ":***@"));

module.exports = { databaseUrl };
