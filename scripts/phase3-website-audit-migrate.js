/**
 * Phase 3 — Website audit + Pitch (additive, non-destructive).
 *
 * - CompanyAuditStatus / WebsiteAuditStatus / PitchStatus / PitchReviewMode enums
 * - Timeline: AUDIT_FAILED, PITCH_APPROVED, PITCH_REJECTED, PITCH_EDITED
 * - Company audit columns
 * - website_audits + pitches tables
 *
 * Usage:
 *   DRY_RUN=1 npm run db:migrate:phase3-website-audit
 *   npm run db:migrate:phase3-website-audit
 *
 * Production: pg_dump before applying.
 */
const { PrismaClient } = require("@prisma/client");
require("./load-env");

const prisma = new PrismaClient();
const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

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

async function indexExists(client, indexName) {
  const rows = await client.$queryRawUnsafe(
    `SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = $1 LIMIT 1`,
    indexName
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

async function ensureEnumValue(client, enumName, value) {
  if (!(await enumExists(client, enumName))) {
    throw new Error(`Enum ${enumName} missing`);
  }
  if (await enumHasValue(client, enumName, value)) {
    console.log(`  skip enum value ${enumName}.${value}`);
    return;
  }
  console.log(`  add enum value ${enumName}.${value} (outside txn)`);
  if (!DRY_RUN) {
    await client.$executeRawUnsafe(
      `ALTER TYPE "${enumName}" ADD VALUE IF NOT EXISTS '${value}'`
    );
  }
}

async function ensureEnum(client, name, values) {
  if (await enumExists(client, name)) {
    console.log(`  skip enum ${name} (exists)`);
    for (const v of values) {
      await ensureEnumValue(client, name, v);
    }
    return;
  }
  console.log(`  create enum ${name}`);
  if (!DRY_RUN) {
    const list = values.map((v) => `'${v}'`).join(", ");
    await client.$executeRawUnsafe(
      `CREATE TYPE "${name}" AS ENUM (${list})`
    );
  }
}

async function ensureColumn(client, table, column, ddl) {
  if (await columnExists(client, table, column)) {
    console.log(`  skip column ${table}.${column}`);
    return;
  }
  console.log(`  add column ${table}.${column}`);
  if (!DRY_RUN) {
    await client.$executeRawUnsafe(`ALTER TABLE "${table}" ADD COLUMN ${ddl}`);
  }
}

async function ensureIndex(client, name, sql) {
  if (await indexExists(client, name)) {
    console.log(`  skip index ${name}`);
    return;
  }
  console.log(`  create index ${name}`);
  if (!DRY_RUN) {
    await client.$executeRawUnsafe(sql);
  }
}

async function main() {
  console.log(
    "Phase 3 — website audit migrate" + (DRY_RUN ? " (DRY_RUN)" : "")
  );

  await ensureEnum(prisma, "CompanyAuditStatus", [
    "PENDING",
    "DONE",
    "FAILED",
    "SKIPPED",
  ]);
  await ensureEnum(prisma, "WebsiteAuditStatus", [
    "PENDING",
    "DONE",
    "FAILED",
    "SKIPPED",
  ]);
  await ensureEnum(prisma, "PitchStatus", [
    "DRAFT",
    "APPROVED",
    "REJECTED",
    "SUPERSEDED",
  ]);
  await ensureEnum(prisma, "PitchReviewMode", [
    "AUTO_APPROVE",
    "REVIEW_REQUIRED",
  ]);

  for (const v of [
    "AUDIT_FAILED",
    "PITCH_APPROVED",
    "PITCH_REJECTED",
    "PITCH_EDITED",
  ]) {
    await ensureEnumValue(prisma, "CompanyTimelineEventType", v);
  }

  await ensureColumn(
    prisma,
    "companies",
    "audit_status",
    `"audit_status" "CompanyAuditStatus"`
  );
  await ensureColumn(
    prisma,
    "companies",
    "audited_at",
    `"audited_at" TIMESTAMP(3)`
  );
  await ensureColumn(
    prisma,
    "companies",
    "audit_error",
    `"audit_error" TEXT`
  );
  await ensureColumn(
    prisma,
    "companies",
    "audit_attempts",
    `"audit_attempts" INTEGER NOT NULL DEFAULT 0`
  );
  await ensureIndex(
    prisma,
    "companies_organization_id_audit_status_idx",
    `CREATE INDEX "companies_organization_id_audit_status_idx"
     ON "companies"("organization_id", "audit_status")`
  );

  if (!(await tableExists(prisma, "website_audits"))) {
    console.log("  create table website_audits");
    if (!DRY_RUN) {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE "website_audits" (
          "id" TEXT PRIMARY KEY,
          "organization_id" TEXT NOT NULL,
          "company_id" TEXT NOT NULL,
          "status" "WebsiteAuditStatus" NOT NULL DEFAULT 'PENDING',
          "page_speed_mobile" INTEGER,
          "page_speed_desktop" INTEGER,
          "core_metrics" JSONB,
          "checks" JSONB,
          "findings" JSONB,
          "pitch" JSONB,
          "model_used" TEXT,
          "cost_usd" DECIMAL(12,6),
          "error" TEXT,
          "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "website_audits_organization_id_fkey"
            FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "website_audits_company_id_fkey"
            FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE
        )
      `);
      await prisma.$executeRawUnsafe(
        `CREATE INDEX "website_audits_organization_id_created_at_idx"
         ON "website_audits"("organization_id", "created_at")`
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX "website_audits_company_id_created_at_idx"
         ON "website_audits"("company_id", "created_at")`
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX "website_audits_organization_id_status_idx"
         ON "website_audits"("organization_id", "status")`
      );
    }
  } else {
    console.log("  skip table website_audits");
  }

  if (!(await tableExists(prisma, "pitches"))) {
    console.log("  create table pitches");
    if (!DRY_RUN) {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE "pitches" (
          "id" TEXT PRIMARY KEY,
          "organization_id" TEXT NOT NULL,
          "company_id" TEXT NOT NULL,
          "contact_id" TEXT NOT NULL,
          "opportunity_id" TEXT,
          "website_audit_id" TEXT NOT NULL,
          "status" "PitchStatus" NOT NULL DEFAULT 'DRAFT',
          "personalized_first_line" TEXT NOT NULL,
          "short_pitch" TEXT NOT NULL,
          "top_issue" TEXT,
          "recommended_service" TEXT,
          "confidence" INTEGER,
          "edited_by_user" BOOLEAN NOT NULL DEFAULT false,
          "missing_vars" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
          "approved_at" TIMESTAMP(3),
          "approved_by" TEXT,
          "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "pitches_organization_id_fkey"
            FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "pitches_company_id_fkey"
            FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "pitches_contact_id_fkey"
            FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "pitches_opportunity_id_fkey"
            FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE,
          CONSTRAINT "pitches_website_audit_id_fkey"
            FOREIGN KEY ("website_audit_id") REFERENCES "website_audits"("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "pitches_approved_by_fkey"
            FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
        )
      `);
      await prisma.$executeRawUnsafe(
        `CREATE INDEX "pitches_organization_id_status_idx"
         ON "pitches"("organization_id", "status")`
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX "pitches_company_id_status_idx"
         ON "pitches"("company_id", "status")`
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX "pitches_contact_id_status_idx"
         ON "pitches"("contact_id", "status")`
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX "pitches_website_audit_id_idx"
         ON "pitches"("website_audit_id")`
      );
    }
  } else {
    console.log("  skip table pitches");
  }

  console.log("Phase 3 migrate done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
