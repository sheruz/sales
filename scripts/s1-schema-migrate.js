/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * S1 additive schema migrate (idempotent).
 * Default: DRY_RUN (prints planned DDL). APPLY=1 to execute.
 *
 * Usage:
 *   node scripts/s1-schema-migrate.js
 *   APPLY=1 node scripts/s1-schema-migrate.js
 */
const {
  createPrisma,
  isApply,
  tableExists,
  columnExists,
  enumExists,
  enumHasValue,
} = require("./s1-lib");

const APPLY = isApply();

async function ensureEnum(client, name, values) {
  if (!(await enumExists(client, name))) {
    console.log(`  CREATE TYPE ${name}`);
    if (APPLY) {
      const list = values.map((v) => `'${v}'`).join(", ");
      await client.$executeRawUnsafe(`CREATE TYPE "${name}" AS ENUM (${list})`);
    }
    return;
  }
  console.log(`  skip enum ${name} (exists)`);
  for (const v of values) {
    if (await enumHasValue(client, name, v)) {
      console.log(`  skip enum value ${name}.${v}`);
      continue;
    }
    console.log(`  ADD VALUE ${name}.${v}`);
    if (APPLY) {
      await client.$executeRawUnsafe(
        `ALTER TYPE "${name}" ADD VALUE IF NOT EXISTS '${v}'`
      );
    }
  }
}

async function ensureColumn(client, table, column, ddl) {
  if (await columnExists(client, table, column)) {
    console.log(`  skip column ${table}.${column}`);
    return;
  }
  console.log(`  ADD COLUMN ${table}.${column}`);
  if (APPLY) {
    await client.$executeRawUnsafe(
      `ALTER TABLE "${table}" ADD COLUMN ${ddl}`
    );
  }
}

async function ensureTable(client, name, createSql) {
  if (await tableExists(client, name)) {
    console.log(`  skip table ${name}`);
    return;
  }
  console.log(`  CREATE TABLE ${name}`);
  if (APPLY) {
    await client.$executeRawUnsafe(createSql);
  }
}

async function ensureIndex(client, name, sql) {
  const rows = await client.$queryRawUnsafe(
    `SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = $1 LIMIT 1`,
    name
  );
  if (Array.isArray(rows) && rows.length > 0) {
    console.log(`  skip index ${name}`);
    return;
  }
  console.log(`  CREATE INDEX ${name}`);
  if (APPLY) {
    await client.$executeRawUnsafe(sql);
  }
}

async function main() {
  const prisma = createPrisma();
  console.log(JSON.stringify({ mode: APPLY ? "APPLY" : "DRY_RUN", phase: "s1-schema" }, null, 2));
  try {
    // Enums (ADD VALUE outside txn when type exists)
    await ensureEnum(prisma, "PlatformRole", ["SUPER_ADMIN", "PLATFORM_SUPPORT"]);
    await ensureEnum(prisma, "PlanVisibility", [
      "PUBLIC",
      "PRIVATE",
      "INTERNAL",
      "DRAFT",
    ]);
    await ensureEnum(prisma, "TenantIntegrationStatus", [
      "CONNECTED",
      "NEEDS_RECONNECT",
      "ERROR",
      "DISCONNECTED",
    ]);
    await ensureEnum(prisma, "IntegrationOAuthMode", [
      "PLATFORM_APP",
      "TENANT_APP",
    ]);
    await ensureEnum(prisma, "IntegrationKeyMode", ["BYOK", "MANAGED"]);

    if (await enumExists(prisma, "SubscriptionStatus")) {
      if (!(await enumHasValue(prisma, "SubscriptionStatus", "SUSPENDED"))) {
        console.log("  ADD VALUE SubscriptionStatus.SUSPENDED");
        if (APPLY) {
          await prisma.$executeRawUnsafe(
            `ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'SUSPENDED'`
          );
        }
      } else {
        console.log("  skip enum value SubscriptionStatus.SUSPENDED");
      }
    }

    await ensureColumn(
      prisma,
      "users",
      "platform_role",
      `"platform_role" "PlatformRole"`
    );
    await ensureIndex(
      prisma,
      "users_platform_role_idx",
      `CREATE INDEX "users_platform_role_idx" ON "users" ("platform_role")`
    );

    await ensureColumn(
      prisma,
      "plans",
      "code",
      `"code" TEXT`
    );
    await ensureColumn(
      prisma,
      "plans",
      "visibility",
      `"visibility" "PlanVisibility" NOT NULL DEFAULT 'PUBLIC'`
    );
    // unique on code when present
    const codeUnique = await prisma.$queryRawUnsafe(
      `SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'plans_code_key' LIMIT 1`
    );
    if (!(Array.isArray(codeUnique) && codeUnique.length > 0)) {
      console.log("  CREATE UNIQUE INDEX plans_code_key");
      if (APPLY) {
        await prisma.$executeRawUnsafe(
          `CREATE UNIQUE INDEX "plans_code_key" ON "plans" ("code")`
        );
      }
    } else {
      console.log("  skip index plans_code_key");
    }

    await ensureTable(
      prisma,
      "tenant_integrations",
      `CREATE TABLE "tenant_integrations" (
        "id" TEXT PRIMARY KEY,
        "organization_id" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
        "provider_id" TEXT NOT NULL,
        "external_key" TEXT NOT NULL DEFAULT 'default',
        "label" TEXT,
        "status" "TenantIntegrationStatus" NOT NULL DEFAULT 'DISCONNECTED',
        "encrypted_credentials" TEXT,
        "public_config" JSONB,
        "oauth_mode" "IntegrationOAuthMode",
        "key_mode" "IntegrationKeyMode" NOT NULL DEFAULT 'BYOK',
        "managed_mode_enabled" BOOLEAN NOT NULL DEFAULT false,
        "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
        "token_expires_at" TIMESTAMP(3),
        "last_health_check_at" TIMESTAMP(3),
        "last_health_ok" BOOLEAN,
        "last_error" TEXT,
        "connected_by_user_id" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
        "legacy_source" TEXT,
        "legacy_source_id" TEXT,
        "metadata" JSONB,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "tenant_integrations_org_provider_key_unique"
          UNIQUE ("organization_id", "provider_id", "external_key")
      )`
    );
    await ensureIndex(
      prisma,
      "tenant_integrations_organization_id_idx",
      `CREATE INDEX "tenant_integrations_organization_id_idx" ON "tenant_integrations" ("organization_id")`
    );
    await ensureIndex(
      prisma,
      "tenant_integrations_provider_id_idx",
      `CREATE INDEX "tenant_integrations_provider_id_idx" ON "tenant_integrations" ("provider_id")`
    );

    await ensureTable(
      prisma,
      "usage_events",
      `CREATE TABLE "usage_events" (
        "id" TEXT PRIMARY KEY,
        "organization_id" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
        "metric" TEXT NOT NULL,
        "quantity" INTEGER NOT NULL DEFAULT 1,
        "period_start" DATE NOT NULL,
        "reference_type" TEXT,
        "reference_id" TEXT,
        "idempotency_key" TEXT,
        "metadata" JSONB,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "usage_events_org_idempotency_key"
          UNIQUE ("organization_id", "idempotency_key")
      )`
    );
    await ensureIndex(
      prisma,
      "usage_events_org_metric_period_idx",
      `CREATE INDEX "usage_events_org_metric_period_idx" ON "usage_events" ("organization_id", "metric", "period_start")`
    );

    await ensureTable(
      prisma,
      "platform_audit_logs",
      `CREATE TABLE "platform_audit_logs" (
        "id" TEXT PRIMARY KEY,
        "actor_user_id" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
        "action" TEXT NOT NULL,
        "target_type" TEXT NOT NULL,
        "target_id" TEXT,
        "organization_id" TEXT REFERENCES "organizations"("id") ON DELETE SET NULL,
        "before" JSONB,
        "after" JSONB,
        "reason" TEXT,
        "ip_address" TEXT,
        "user_agent" TEXT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`
    );
    await ensureIndex(
      prisma,
      "platform_audit_logs_created_at_idx",
      `CREATE INDEX "platform_audit_logs_created_at_idx" ON "platform_audit_logs" ("created_at")`
    );

    console.log(
      JSON.stringify(
        {
          done: true,
          applied: APPLY,
          next: APPLY
            ? "Run prisma generate, then s1-apply.js APPLY=1"
            : "Review DDL above, then APPLY=1 node scripts/s1-schema-migrate.js",
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
