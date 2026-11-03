/**
 * PoW6 — personal preview page + visit tracking + platform send settings.
 *
 *   DRY_RUN=1 node scripts/run-with-env.js node scripts/pow6-preview-migrate.js
 *   node scripts/run-with-env.js node scripts/pow6-preview-migrate.js
 */
/* eslint-disable @typescript-eslint/no-require-imports */
require("./load-env");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

async function tableExists(table) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1 LIMIT 1`,
    table
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function enumHasValue(enumName, value) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT 1 FROM pg_enum e
     JOIN pg_type t ON t.oid = e.enumtypid
     WHERE t.typname = $1 AND e.enumlabel = $2 LIMIT 1`,
    enumName,
    value
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function exec(sql) {
  console.log(`  ${DRY_RUN ? "DRY " : ""}${sql.split("\n")[0].slice(0, 100)}…`);
  if (!DRY_RUN) await prisma.$executeRawUnsafe(sql);
}

async function main() {
  console.log(`PoW6 preview migrate${DRY_RUN ? " (DRY_RUN)" : ""}`);

  for (const [enumName, value] of [
    ["UsageMetric", "AUDIT_DEEP"],
    ["UsageMetric", "PREVIEW_PAGE"],
    ["NotificationType", "POW_HOT_LEAD"],
  ]) {
    if (await enumHasValue(enumName, value)) {
      console.log(`  enum ${enumName}.${value} exists`);
    } else {
      await exec(`ALTER TYPE "${enumName}" ADD VALUE '${value}'`);
    }
  }

  if (!(await tableExists("platform_settings"))) {
    await exec(`
CREATE TABLE "platform_settings" (
  "key" TEXT PRIMARY KEY,
  "value" JSONB NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_by_user_id" TEXT
)`);
  } else {
    console.log("  platform_settings exists");
  }

  if (!(await tableExists("pow_preview_pages"))) {
    await exec(`
CREATE TABLE "pow_preview_pages" (
  "id" TEXT PRIMARY KEY,
  "organization_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "contact_id" TEXT NOT NULL,
  "pitch_id" TEXT NOT NULL,
  "public_slug" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "removed_at" TIMESTAMP(3),
  "visit_count" INTEGER NOT NULL DEFAULT 0,
  "first_human_visit_at" TIMESTAMP(3),
  "last_human_visit_at" TIMESTAMP(3),
  "total_dwell_ms" INTEGER NOT NULL DEFAULT 0,
  "hot_alerted_at" TIMESTAMP(3),
  "credit_charged_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
)`);
    await exec(
      `CREATE UNIQUE INDEX "pow_preview_pages_public_slug_key" ON "pow_preview_pages"("public_slug")`
    );
    await exec(
      `CREATE UNIQUE INDEX "pow_preview_pages_pitch_id_key" ON "pow_preview_pages"("pitch_id")`
    );
    await exec(
      `CREATE INDEX "pow_preview_pages_organization_id_first_human_visit_at_idx" ON "pow_preview_pages"("organization_id", "first_human_visit_at")`
    );
    await exec(
      `ALTER TABLE "pow_preview_pages" ADD CONSTRAINT "pow_preview_pages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE`
    );
    await exec(
      `ALTER TABLE "pow_preview_pages" ADD CONSTRAINT "pow_preview_pages_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE`
    );
    await exec(
      `ALTER TABLE "pow_preview_pages" ADD CONSTRAINT "pow_preview_pages_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE`
    );
    await exec(
      `ALTER TABLE "pow_preview_pages" ADD CONSTRAINT "pow_preview_pages_pitch_id_fkey" FOREIGN KEY ("pitch_id") REFERENCES "pitches"("id") ON DELETE CASCADE ON UPDATE CASCADE`
    );
  } else {
    console.log("  pow_preview_pages exists");
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
