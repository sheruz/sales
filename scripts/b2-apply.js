/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * B2 apply: idempotent schema (step-by-step) + seed default top-up packs.
 * Safe to re-run after a partial failure. Requires APPLY=1.
 *
 *   node scripts/b2-dry-run.js
 *   APPLY=1 node scripts/b2-apply.js
 */
const {
  DEFAULT_TOP_UP_PACKS,
  createPrisma,
  inspectB2Schema,
  isApply,
  tableExists,
  columnExists,
  enumExists,
} = require("./b2-lib");
const { randomUUID } = require("crypto");

async function ensureEnum(client, name, values, log) {
  if (!(await enumExists(client, name))) {
    const list = values.map((v) => `'${v}'`).join(", ");
    await client.$executeRawUnsafe(`CREATE TYPE "${name}" AS ENUM (${list})`);
    log.push(`CREATE TYPE ${name}`);
    return;
  }
  log.push(`skip enum ${name}`);
}

async function ensureColumn(client, table, column, ddl, log) {
  if (await columnExists(client, table, column)) {
    log.push(`skip ${table}.${column}`);
    return;
  }
  await client.$executeRawUnsafe(`ALTER TABLE "${table}" ADD COLUMN ${ddl}`);
  log.push(`ADD ${table}.${column}`);
}

async function ensureIndex(client, name, sql, log) {
  const rows = await client.$queryRawUnsafe(
    `SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = $1 LIMIT 1`,
    name
  );
  if (Array.isArray(rows) && rows.length > 0) {
    log.push(`skip index ${name}`);
    return;
  }
  await client.$executeRawUnsafe(sql);
  log.push(`CREATE INDEX ${name}`);
}

async function ensureTable(client, name, createSql, log) {
  if (await tableExists(client, name)) {
    log.push(`skip table ${name}`);
    return;
  }
  await client.$executeRawUnsafe(createSql);
  log.push(`CREATE TABLE ${name}`);
}

async function ensureFk(client, table, constraint, sql, log) {
  const rows = await client.$queryRawUnsafe(
    `SELECT 1 FROM pg_constraint WHERE conname = $1 LIMIT 1`,
    constraint
  );
  if (Array.isArray(rows) && rows.length > 0) {
    log.push(`skip fk ${constraint}`);
    return;
  }
  try {
    await client.$executeRawUnsafe(sql);
    log.push(`ADD FK ${constraint}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/already exists|duplicate/i.test(msg)) {
      log.push(`skip fk ${constraint} (exists)`);
      return;
    }
    throw err;
  }
}

async function applySchema(prisma, log) {
  // Enums first (required by columns/tables below)
  await ensureEnum(prisma, "PlanVersionStatus", ["DRAFT", "PUBLISHED"], log);
  await ensureEnum(
    prisma,
    "PlanLimitNoticeStatus",
    ["PENDING", "RESOLVED", "APPLIED"],
    log
  );

  // plan_versions
  await ensureColumn(
    prisma,
    "plan_versions",
    "status",
    `"status" "PlanVersionStatus" NOT NULL DEFAULT 'PUBLISHED'`,
    log
  );
  await ensureColumn(
    prisma,
    "plan_versions",
    "editor_revision",
    `"editor_revision" INTEGER NOT NULL DEFAULT 0`,
    log
  );
  await ensureColumn(
    prisma,
    "plan_versions",
    "published_at",
    `"published_at" TIMESTAMP(3)`,
    log
  );
  await ensureColumn(
    prisma,
    "plan_versions",
    "published_by_user_id",
    `"published_by_user_id" TEXT`,
    log
  );
  await ensureColumn(
    prisma,
    "plan_versions",
    "apply_mode",
    `"apply_mode" TEXT`,
    log
  );
  await ensureColumn(
    prisma,
    "plan_versions",
    "updated_at",
    `"updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    log
  );
  await ensureIndex(
    prisma,
    "plan_versions_status_idx",
    `CREATE INDEX "plan_versions_status_idx" ON "plan_versions"("status")`,
    log
  );

  // overrides
  await ensureColumn(
    prisma,
    "org_entitlement_overrides",
    "expires_at",
    `"expires_at" TIMESTAMP(3)`,
    log
  );
  await ensureIndex(
    prisma,
    "org_entitlement_overrides_expires_at_idx",
    `CREATE INDEX "org_entitlement_overrides_expires_at_idx" ON "org_entitlement_overrides"("expires_at")`,
    log
  );

  // pause flags on seat resources
  const pauseTables = [
    "organization_users",
    "outbound_mailboxes",
    "campaigns",
    "outreach_sequences",
    "icps",
    "source_connectors",
  ];
  for (const table of pauseTables) {
    await ensureColumn(prisma, table, "paused_at", `"paused_at" TIMESTAMP(3)`, log);
    await ensureColumn(prisma, table, "pause_reason", `"pause_reason" TEXT`, log);
    await ensureColumn(
      prisma,
      table,
      "pause_notice_at",
      `"pause_notice_at" TIMESTAMP(3)`,
      log
    );
    await ensureIndex(
      prisma,
      `${table}_paused_at_idx`,
      `CREATE INDEX "${table}_paused_at_idx" ON "${table}"("paused_at")`,
      log
    );
  }

  await ensureTable(
    prisma,
    "top_up_packs",
    `CREATE TABLE "top_up_packs" (
      "id" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "credits" INTEGER NOT NULL,
      "price" DECIMAL(12, 2) NOT NULL,
      "currency" TEXT NOT NULL DEFAULT 'USD',
      "active" BOOLEAN NOT NULL DEFAULT true,
      "sort_order" INTEGER NOT NULL DEFAULT 0,
      "archived_at" TIMESTAMP(3),
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "top_up_packs_pkey" PRIMARY KEY ("id")
    )`,
    log
  );
  await ensureIndex(
    prisma,
    "top_up_packs_active_idx",
    `CREATE INDEX "top_up_packs_active_idx" ON "top_up_packs"("active")`,
    log
  );
  await ensureIndex(
    prisma,
    "top_up_packs_archived_at_idx",
    `CREATE INDEX "top_up_packs_archived_at_idx" ON "top_up_packs"("archived_at")`,
    log
  );

  await ensureTable(
    prisma,
    "plan_limit_notices",
    `CREATE TABLE "plan_limit_notices" (
      "id" TEXT NOT NULL,
      "organization_id" TEXT NOT NULL,
      "feature_key" TEXT NOT NULL,
      "allowed_count" INTEGER NOT NULL,
      "plan_version_id" TEXT,
      "status" "PlanLimitNoticeStatus" NOT NULL DEFAULT 'PENDING',
      "notice_at" TIMESTAMP(3) NOT NULL,
      "deadline_at" TIMESTAMP(3) NOT NULL,
      "selected_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      "resolved_at" TIMESTAMP(3),
      "applied_at" TIMESTAMP(3),
      "email_stub_sent_at" TIMESTAMP(3),
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "plan_limit_notices_pkey" PRIMARY KEY ("id")
    )`,
    log
  );
  await ensureIndex(
    prisma,
    "plan_limit_notices_organization_id_status_idx",
    `CREATE INDEX "plan_limit_notices_organization_id_status_idx" ON "plan_limit_notices"("organization_id", "status")`,
    log
  );
  await ensureIndex(
    prisma,
    "plan_limit_notices_deadline_at_idx",
    `CREATE INDEX "plan_limit_notices_deadline_at_idx" ON "plan_limit_notices"("deadline_at")`,
    log
  );
  await ensureIndex(
    prisma,
    "plan_limit_notices_feature_key_idx",
    `CREATE INDEX "plan_limit_notices_feature_key_idx" ON "plan_limit_notices"("feature_key")`,
    log
  );

  await ensureFk(
    prisma,
    "plan_limit_notices",
    "plan_limit_notices_organization_id_fkey",
    `ALTER TABLE "plan_limit_notices"
      ADD CONSTRAINT "plan_limit_notices_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE`,
    log
  );
  await ensureFk(
    prisma,
    "plan_limit_notices",
    "plan_limit_notices_plan_version_id_fkey",
    `ALTER TABLE "plan_limit_notices"
      ADD CONSTRAINT "plan_limit_notices_plan_version_id_fkey"
      FOREIGN KEY ("plan_version_id") REFERENCES "plan_versions"("id")
      ON DELETE SET NULL ON UPDATE CASCADE`,
    log
  );
}

async function main() {
  if (!isApply()) {
    console.error("Refusing to apply without APPLY=1");
    console.error("Run: APPLY=1 node scripts/b2-apply.js");
    process.exit(1);
  }

  const prisma = createPrisma();
  const out = {
    phase: "B2",
    mode: "APPLY",
    at: new Date().toISOString(),
    schemaBefore: null,
    schemaAfter: null,
    schemaSteps: [],
    packsCreated: [],
    notes: [],
    fatal: [],
  };

  try {
    out.schemaBefore = await inspectB2Schema(prisma);
    out.notes.push(
      out.schemaBefore.ready
        ? "Schema already ready — verifying / filling gaps"
        : "Schema incomplete — applying missing pieces (idempotent)"
    );

    await applySchema(prisma, out.schemaSteps);

    out.schemaAfter = await inspectB2Schema(prisma);
    if (!out.schemaAfter.ready) {
      out.fatal.push("Schema still not ready after apply");
      out.notes.push(JSON.stringify(out.schemaAfter));
    } else {
      for (const def of DEFAULT_TOP_UP_PACKS) {
        const existing = await prisma.topUpPack.findFirst({
          where: { credits: def.credits, archivedAt: null },
        });
        if (existing) {
          out.packsCreated.push({
            credits: def.credits,
            action: "skip",
            id: existing.id,
          });
          continue;
        }
        const created = await prisma.topUpPack.create({
          data: {
            id: randomUUID(),
            name: def.name,
            credits: def.credits,
            price: def.price,
            currency: "USD",
            sortOrder: def.sortOrder,
            active: true,
          },
        });
        out.packsCreated.push({
          credits: def.credits,
          action: "created",
          id: created.id,
        });
      }
    }

    out.notes.push("provider sync pending — B3 (stub only)");
  } catch (err) {
    out.fatal.push(err instanceof Error ? err.message : String(err));
  } finally {
    await prisma.$disconnect().catch(() => {});
  }

  console.log(JSON.stringify(out, null, 2));
  if (out.fatal.length) process.exit(1);
}

main();
