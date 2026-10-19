/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Shared helpers for B1 seed / migrate scripts.
 */
require("./load-env");
const { ensureDatabaseUrl } = require("./database-url");
ensureDatabaseUrl();

const {
  OWNER_ORG_NAME,
  TEST_TENANT_NAME,
  createPrisma,
  readOnlyPrisma,
  tableExists,
  columnExists,
  enumExists,
  enumHasValue,
  isApply,
  maskEmail,
} = require("./s2-lib");

const {
  B1_PLAN_CATALOG,
  LEGACY_PLAN_NAMES,
  LEGACY_PLAN_CODES,
  CATALOG_CODES,
  featuresToRows,
} = require("./b1-plan-catalog");

const SCHEMA_CHECKS = {
  enums: [
    { type: "OrganizationStatus", value: "INVITED" },
    { type: "OrganizationStatus", value: "ARCHIVED" },
    { type: "SubscriptionStatus", value: "NONE" },
    { type: "SubscriptionStatus", value: "EXPIRED" },
  ],
  columns: [
    { table: "organizations", column: "country" },
    { table: "organizations", column: "internal_notes" },
    { table: "plans", column: "most_popular" },
    { table: "plans", column: "current_version_id" },
    { table: "plans", column: "archived_at" },
    { table: "subscriptions", column: "plan_version_id" },
    { table: "subscriptions", column: "pending_plan_version_id" },
    { table: "subscriptions", column: "pending_apply_at" },
    { table: "subscriptions", column: "access_mode" },
    { table: "subscriptions", column: "trial_ends_at" },
    { table: "subscriptions", column: "grace_period_ends_at" },
    { table: "subscriptions", column: "read_only_until" },
  ],
  tables: ["plan_versions", "plan_version_features"],
};

async function inspectB1Schema(client) {
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

function isPlatformOwnerOrg(org, platformOwnerId) {
  if (platformOwnerId && org.id === platformOwnerId) return true;
  if (org.name === OWNER_ORG_NAME) return true;
  return false;
}

function isLegacyPlan(plan) {
  if (plan.code && CATALOG_CODES.includes(plan.code)) return false;
  if (plan.code && LEGACY_PLAN_CODES.includes(plan.code)) return true;
  if (LEGACY_PLAN_NAMES.includes(plan.name)) return true;
  return false;
}

/**
 * Proposed org status / subscription mapping (dry-run + apply share rules).
 * PLATFORM_OWNER is never mutated by callers — they skip before calling this.
 */
function proposeOrgMigration(org, sub) {
  const currentOrgStatus = org.status;
  const currentSubStatus = sub?.status ?? null;
  const planCode = sub?.plan?.code ?? null;
  const planName = sub?.plan?.name ?? null;
  const deleted = Boolean(org.deletedAt);

  let proposedOrgStatus = currentOrgStatus;
  let proposedSubStatus = currentSubStatus;
  const actions = [];

  if (deleted || currentOrgStatus === "CANCELLED") {
    proposedOrgStatus = "ARCHIVED";
    actions.push("org → ARCHIVED (CANCELLED or deletedAt)");
  } else if (currentOrgStatus === "TRIAL") {
    proposedOrgStatus = "ACTIVE";
    actions.push("org TRIAL → ACTIVE");
  } else if (currentOrgStatus === "SUSPENDED") {
    proposedOrgStatus = "ACTIVE";
    proposedSubStatus = "SUSPENDED";
    actions.push("org SUSPENDED → ACTIVE + sub SUSPENDED");
  }

  return {
    organizationId: org.id,
    name: org.name,
    deletedAt: org.deletedAt,
    current: {
      orgStatus: currentOrgStatus,
      subStatus: currentSubStatus,
      planCode,
      planName,
      planVersionId: sub?.planVersionId ?? null,
    },
    proposed: {
      orgStatus: proposedOrgStatus,
      subStatus: proposedSubStatus,
    },
    actions,
  };
}

module.exports = {
  OWNER_ORG_NAME,
  TEST_TENANT_NAME,
  B1_PLAN_CATALOG,
  LEGACY_PLAN_NAMES,
  LEGACY_PLAN_CODES,
  CATALOG_CODES,
  featuresToRows,
  SCHEMA_CHECKS,
  createPrisma,
  readOnlyPrisma,
  tableExists,
  columnExists,
  enumExists,
  enumHasValue,
  isApply,
  maskEmail,
  inspectB1Schema,
  isPlatformOwnerOrg,
  isLegacyPlan,
  proposeOrgMigration,
};
