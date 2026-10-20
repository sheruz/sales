/* eslint-disable @typescript-eslint/no-require-imports */
require("./load-env");
const { ensureDatabaseUrl } = require("./database-url");
ensureDatabaseUrl();

const {
  createPrisma,
  readOnlyPrisma,
  tableExists,
  columnExists,
  isApply,
} = require("./s2-lib");

const SCHEMA_CHECKS = {
  columns: [
    { table: "organizations", column: "allowed_checkout_methods" },
    { table: "organizations", column: "stripe_customer_id" },
    { table: "organizations", column: "stripe_customer_env" },
  ],
  tables: ["payment_provider_configs", "payment_settings"],
};

async function inspectB31Schema(client) {
  const schema = { columns: {}, tables: {}, ready: true };
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
  inspectB31Schema,
  createPrisma,
  readOnlyPrisma,
  isApply,
  tableExists,
  columnExists,
};
