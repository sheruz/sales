/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Shared helpers for S1 scripts. Always load .env + ensureDatabaseUrl.
 */
require("./load-env");
const { ensureDatabaseUrl } = require("./database-url");
ensureDatabaseUrl();

const { PrismaClient } = require("@prisma/client");

const OWNER_ORG_NAME = process.env.OWNER_ORG_NAME || "Default Workspace";
const SEED_PASSWORD = "Admin@123";
const SEED_EMAILS = [
  "superadmin@salesplatform.local",
  "admin@salesplatform.local",
  "manager@salesplatform.local",
  "rep@salesplatform.local",
];

function maskEmail(email) {
  if (!email || typeof email !== "string") return null;
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const localMask =
    local.length <= 2
      ? `${local[0] ?? "*"}*`
      : `${local[0]}***${local[local.length - 1]}`;
  return `${localMask}@${domain}`;
}

function isApply() {
  return process.env.APPLY === "1" || process.env.APPLY === "true";
}

function createPrisma() {
  return new PrismaClient();
}

async function tableExists(client, table) {
  const rows = await client.$queryRawUnsafe(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1 LIMIT 1`,
    table
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function columnExists(client, table, column) {
  const rows = await client.$queryRawUnsafe(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
     LIMIT 1`,
    table,
    column
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function enumExists(client, name) {
  const rows = await client.$queryRawUnsafe(
    `SELECT 1 FROM pg_type WHERE typname = $1 LIMIT 1`,
    name
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function enumHasValue(client, enumName, value) {
  const rows = await client.$queryRawUnsafe(
    `SELECT 1 FROM pg_enum e
     JOIN pg_type t ON t.oid = e.enumtypid
     WHERE t.typname = $1 AND e.enumlabel = $2 LIMIT 1`,
    enumName,
    value
  );
  return Array.isArray(rows) && rows.length > 0;
}

module.exports = {
  OWNER_ORG_NAME,
  SEED_PASSWORD,
  SEED_EMAILS,
  maskEmail,
  isApply,
  createPrisma,
  tableExists,
  columnExists,
  enumExists,
  enumHasValue,
  ensureDatabaseUrl,
};
