/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const { ensureDatabaseUrl } = require("./database-url");
const { loadEnvFile } = require("./load-env-file");

const rootDir = path.join(__dirname, "..");
const envPath = path.join(rootDir, ".env");

if (!loadEnvFile(envPath)) {
  console.warn("[env] No .env file found at", envPath);
}

const databaseUrl = ensureDatabaseUrl();

const appPort = process.env.APP_PORT || process.env.PORT || "3000";
process.env.PORT = String(appPort);

console.log("[env] Using database:", databaseUrl.replace(/:([^:@/]+)@/, ":***@"));
console.log("[env] App port:", appPort);

module.exports = { databaseUrl };
