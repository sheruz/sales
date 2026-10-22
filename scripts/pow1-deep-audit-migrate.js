/**
 * PoW1 — Deep audit queue + evidence + WebsiteAudit mode/icp columns.
 *
 * Usage:
 *   DRY_RUN=1 npm run db:migrate:pow1-deep-audit
 *   npm run db:migrate:pow1-deep-audit
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
  console.log(`  add enum value ${enumName}.${value}`);
  if (!DRY_RUN) {
    await client.$executeRawUnsafe(
      `ALTER TYPE "${enumName}" ADD VALUE IF NOT EXISTS '${value}'`
    );
  }
}

async function ensureEnum(client, name, values) {
  if (await enumExists(client, name)) {
    console.log(`  skip enum ${name} (exists)`);
    for (const v of values) await ensureEnumValue(client, name, v);
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
  console.log("PoW1 — deep audit migrate" + (DRY_RUN ? " (DRY_RUN)" : ""));

  await ensureEnum(prisma, "DeepAuditJobStatus", [
    "QUEUED",
    "RUNNING",
    "DONE",
    "FAILED",
    "SKIPPED",
  ]);
  await ensureEnum(prisma, "AuditEvidenceKind", [
    "SCREENSHOT_DESKTOP",
    "SCREENSHOT_MOBILE",
    "OTHER",
  ]);

  await ensureColumn(
    prisma,
    "website_audits",
    "mode",
    `"mode" TEXT NOT NULL DEFAULT 'light'`
  );
  await ensureColumn(
    prisma,
    "website_audits",
    "icp_fit",
    `"icp_fit" TEXT`
  );
  await ensureColumn(
    prisma,
    "website_audits",
    "icp_fit_score",
    `"icp_fit_score" INTEGER`
  );
  await ensureIndex(
    prisma,
    "website_audits_organization_id_mode_idx",
    `CREATE INDEX "website_audits_organization_id_mode_idx"
     ON "website_audits"("organization_id", "mode")`
  );

  if (!(await tableExists(prisma, "audit_evidence"))) {
    console.log("  create table audit_evidence");
    if (!DRY_RUN) {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE "audit_evidence" (
          "id" TEXT PRIMARY KEY,
          "organization_id" TEXT NOT NULL,
          "company_id" TEXT NOT NULL,
          "website_audit_id" TEXT NOT NULL,
          "kind" "AuditEvidenceKind" NOT NULL DEFAULT 'OTHER',
          "relative_path" TEXT NOT NULL,
          "content_type" TEXT NOT NULL,
          "byte_size" INTEGER NOT NULL,
          "expires_at" TIMESTAMP(3) NOT NULL,
          "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "audit_evidence_organization_id_fkey"
            FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "audit_evidence_company_id_fkey"
            FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "audit_evidence_website_audit_id_fkey"
            FOREIGN KEY ("website_audit_id") REFERENCES "website_audits"("id") ON DELETE CASCADE ON UPDATE CASCADE
        )
      `);
      await prisma.$executeRawUnsafe(
        `CREATE INDEX "audit_evidence_organization_id_expires_at_idx"
         ON "audit_evidence"("organization_id", "expires_at")`
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX "audit_evidence_website_audit_id_idx"
         ON "audit_evidence"("website_audit_id")`
      );
    }
  } else {
    console.log("  skip table audit_evidence");
  }

  if (!(await tableExists(prisma, "deep_audit_jobs"))) {
    console.log("  create table deep_audit_jobs");
    if (!DRY_RUN) {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE "deep_audit_jobs" (
          "id" TEXT PRIMARY KEY,
          "organization_id" TEXT NOT NULL,
          "company_id" TEXT NOT NULL,
          "website_audit_id" TEXT,
          "status" "DeepAuditJobStatus" NOT NULL DEFAULT 'QUEUED',
          "attempts" INTEGER NOT NULL DEFAULT 0,
          "max_attempts" INTEGER NOT NULL DEFAULT 2,
          "error" TEXT,
          "locked_at" TIMESTAMP(3),
          "locked_by" TEXT,
          "started_at" TIMESTAMP(3),
          "finished_at" TIMESTAMP(3),
          "metadata" JSONB,
          "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "deep_audit_jobs_organization_id_fkey"
            FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "deep_audit_jobs_company_id_fkey"
            FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "deep_audit_jobs_website_audit_id_fkey"
            FOREIGN KEY ("website_audit_id") REFERENCES "website_audits"("id") ON DELETE SET NULL ON UPDATE CASCADE
        )
      `);
      await prisma.$executeRawUnsafe(
        `CREATE INDEX "deep_audit_jobs_status_created_at_idx"
         ON "deep_audit_jobs"("status", "created_at")`
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX "deep_audit_jobs_organization_id_status_idx"
         ON "deep_audit_jobs"("organization_id", "status")`
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX "deep_audit_jobs_company_id_idx"
         ON "deep_audit_jobs"("company_id")`
      );
    }
  } else {
    console.log("  skip table deep_audit_jobs");
  }

  // Seed credit prices for audit_deep (BYOK + MANAGED = 3)
  if (await tableExists(prisma, "credit_prices") && !DRY_RUN) {
    for (const keyMode of ["BYOK", "MANAGED"]) {
      try {
        await prisma.creditPrice.upsert({
          where: {
            actionType_keyMode: {
              actionType: "audit_deep",
              keyMode,
            },
          },
          create: {
            actionType: "audit_deep",
            keyMode,
            credits: 3,
            active: true,
          },
          update: { credits: 3, active: true },
        });
        console.log(`  upsert credit_prices.audit_deep ${keyMode}=3`);
      } catch (e) {
        console.warn(`  warn: credit_prices.audit_deep ${keyMode}:`, e.message);
      }
    }
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
