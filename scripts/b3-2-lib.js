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
    { table: "organizations", column: "billing_contact_name" },
    { table: "organizations", column: "billing_address" },
    { table: "organizations", column: "billing_country" },
    { table: "organizations", column: "billing_tax_id" },
    { table: "payment_settings", column: "seller_admin_emails" },
  ],
  tables: ["billing_transactions"],
};

async function inspectB32Schema(client) {
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

async function verifyB32(client) {
  const schema = await inspectB32Schema(client);
  const shared = await client.$queryRawUnsafe(`
    SELECT paddle_customer_id, paddle_customer_env, COUNT(*)::int AS n
    FROM organizations
    WHERE paddle_customer_id IS NOT NULL
      AND deleted_at IS NULL
    GROUP BY paddle_customer_id, paddle_customer_env
    HAVING COUNT(*) > 1
  `).catch(() => []);

  const missingBillingEmail = await client.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS n FROM organizations
    WHERE deleted_at IS NULL
      AND billing_email IS NULL
      AND status <> 'ARCHIVED'
  `).catch(() => [{ n: -1 }]);

  return {
    schema,
    sharedPaddleCustomers: shared,
    orgsMissingBillingEmail: missingBillingEmail[0]?.n ?? -1,
    ok:
      schema.ready &&
      (!shared || shared.length === 0),
  };
}

module.exports = {
  SCHEMA_CHECKS,
  inspectB32Schema,
  verifyB32,
  createPrisma,
  readOnlyPrisma,
  isApply,
  tableExists,
  columnExists,
};
