/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const { ensureDatabaseUrl } = require("./database-url");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return false;

  const content = fs.readFileSync(filePath, "utf8");

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }

  return true;
}

const rootDir = path.join(__dirname, "..");
const envPath = path.join(rootDir, ".env");

if (!loadEnvFile(envPath)) {
  console.warn("[env] No .env file found at", envPath);
}

const databaseUrl = ensureDatabaseUrl();
const appPort = process.env.APP_PORT || process.env.PORT || "3000";
process.env.PORT = String(appPort);

module.exports = { databaseUrl, appPort };
