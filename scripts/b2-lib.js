/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Shared helpers for B2 dry-run / apply.
 */
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
    { type: "PlanVersionStatus", value: "DRAFT" },
    { type: "PlanVersionStatus", value: "PUBLISHED" },
    { type: "PlanLimitNoticeStatus", value: "PENDING" },
  ],
  columns: [
    { table: "plan_versions", column: "status" },
    { table: "plan_versions", column: "editor_revision" },
    { table: "plan_versions", column: "published_at" },
    { table: "org_entitlement_overrides", column: "expires_at" },
    { table: "organization_users", column: "paused_at" },
    { table: "outbound_mailboxes", column: "paused_at" },
    { table: "campaigns", column: "paused_at" },
    { table: "outreach_sequences", column: "paused_at" },
    { table: "icps", column: "paused_at" },
    { table: "source_connectors", column: "paused_at" },
  ],
  tables: ["top_up_packs", "plan_limit_notices"],
};

const DEFAULT_TOP_UP_PACKS = [
  { name: "500 credits", credits: 500, price: 29, sortOrder: 1 },
  { name: "2,000 credits", credits: 2000, price: 99, sortOrder: 2 },
  { name: "5,000 credits", credits: 5000, price: 219, sortOrder: 3 },
];

async function inspectB2Schema(client) {
  const schema = {
    enums: {},
    columns: {},
    tables: {},
    ready: true,
  };

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
  DEFAULT_TOP_UP_PACKS,
  inspectB2Schema,
  createPrisma,
  readOnlyPrisma,
  isApply,
  tableExists,
  columnExists,
  enumExists,
  enumHasValue,
};
