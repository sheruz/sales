/* eslint-disable @typescript-eslint/no-require-imports */
require("./load-env");
const { ensureDatabaseUrl } = require("./database-url");
ensureDatabaseUrl();

const {
  createPrisma,
  readOnlyPrisma,
  tableExists,
  columnExists,
  enumExists,
  enumHasValue,
  isApply,
} = require("./s2-lib");

const SCHEMA_CHECKS = {
  enums: [
    { type: "InvoiceStatus", value: "OPEN" },
    { type: "InvoiceStatus", value: "PAID" },
  ],
  columns: [
    { table: "organizations", column: "billing_provider" },
    { table: "organizations", column: "billing_email" },
    { table: "organizations", column: "paddle_customer_id" },
    { table: "subscriptions", column: "provider_environment" },
    { table: "billing_webhook_events", column: "occurred_at" },
    { table: "billing_webhook_events", column: "attempt_count" },
  ],
  tables: [
    "provider_price_maps",
    "invoices",
    "payments",
    "invoice_sequences",
  ],
};

async function inspectB3Schema(client) {
  const schema = { enums: {}, columns: {}, tables: {}, ready: true };
  for (const e of SCHEMA_CHECKS.enums) {
    const key = `${e.type}.${e.value}`;
    const has = await enumHasValue(client, e.type, e.value);
    schema.enums[key] = has;
    if (!has) schema.ready = false;
  }
  for (const c of SCHEMA_CHECKS.columns) {
    const key = `${c.table}.${c.column}`;
    const has = await columnExists(client, c.table, c.column);
    schema.columns[key] = has;
    if (!has) schema.ready = false;
  }
  for (const t of SCHEMA_CHECKS.tables) {
    const has = await tableExists(client, t);
    schema.tables[t] = has;
    if (!has) schema.ready = false;
  }
  return schema;
}

module.exports = {
  SCHEMA_CHECKS,
  inspectB3Schema,
  createPrisma,
  readOnlyPrisma,
  isApply,
  tableExists,
  columnExists,
  enumExists,
  enumHasValue,
};
