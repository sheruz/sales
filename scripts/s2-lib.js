/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Shared helpers for S2 credit scripts.
 */
require("./load-env");
const { ensureDatabaseUrl } = require("./database-url");
ensureDatabaseUrl();

const { PrismaClient } = require("@prisma/client");

const OWNER_ORG_NAME = process.env.OWNER_ORG_NAME || "Default Workspace";
const TEST_TENANT_NAME = process.env.TEST_TENANT_NAME || "Test Tenant";
const TEST_TENANT_STARTING_CREDITS = Number(
  process.env.TEST_TENANT_STARTING_CREDITS || "50"
);
const TEST_TENANT_EMAIL =
  (process.env.TEST_TENANT_EMAIL || "test-tenant@salesplatform.local")
    .trim()
    .toLowerCase();

const DEFAULT_CREDIT_PRICES = [
  { actionType: "google_sourcing_page", byok: 1, managed: 1 },
  { actionType: "crawl", byok: 0, managed: 0 },
  { actionType: "enrichment", byok: 2, managed: 2 },
  { actionType: "audit_pitch", byok: 2, managed: 2 },
  { actionType: "ai_reply_classification", byok: 0, managed: 0 },
  { actionType: "ai_reply_draft", byok: 1, managed: 1 },
  { actionType: "email_sent", byok: 0, managed: 0 },
  { actionType: "meeting_booked", byok: 0, managed: 0 },
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

function readOnlyPrisma() {
  const prisma = new PrismaClient();
  const forbidden = new Set([
    "create",
    "createMany",
    "update",
    "updateMany",
    "upsert",
    "delete",
    "deleteMany",
    "$executeRaw",
    "$executeRawUnsafe",
  ]);

  function wrapModel(model) {
    return new Proxy(model, {
      get(target, prop, receiver) {
        if (typeof prop === "string" && forbidden.has(prop)) {
          throw new Error(`s2-dry-run is READ-ONLY: blocked prisma.*.${prop}`);
        }
        return Reflect.get(target, prop, receiver);
      },
    });
  }

  return new Proxy(prisma, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (
        typeof prop === "string" &&
        value &&
        typeof value === "object" &&
        !prop.startsWith("$") &&
        prop !== "constructor"
      ) {
        return wrapModel(value);
      }
      if (typeof prop === "string" && forbidden.has(prop)) {
        throw new Error(`s2-dry-run is READ-ONLY: blocked prisma.${prop}`);
      }
      return value;
    },
  });
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
  TEST_TENANT_NAME,
  TEST_TENANT_STARTING_CREDITS,
  TEST_TENANT_EMAIL,
  DEFAULT_CREDIT_PRICES,
  maskEmail,
  isApply,
  createPrisma,
  readOnlyPrisma,
  tableExists,
  columnExists,
  enumExists,
  enumHasValue,
  ensureDatabaseUrl,
};
