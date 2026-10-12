/**
 * Quick check: Phase 2 columns/tables present?
 * Usage: node scripts/run-with-env.js node scripts/check-phase2-schema.js
 */
const { PrismaClient } = require("@prisma/client");
require("./load-env");

const prisma = new PrismaClient();

async function main() {
  const cols = await prisma.$queryRawUnsafe(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='companies'
      AND column_name IN ('enrichment_status','enriched_at','enrichment_error','enrichment_attempts')
    ORDER BY column_name
  `);
  const tables = await prisma.$queryRawUnsafe(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_name='cron_tick_logs'
  `);
  const enumVals = await prisma.$queryRawUnsafe(`
    SELECT e.enumlabel FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname IN ('OpportunityStage','IntegrationPlatform','CompanyEnrichmentStatus')
    ORDER BY t.typname, e.enumlabel
  `);

  console.log("companies enrichment columns:", cols);
  console.log("cron_tick_logs:", tables);
  console.log("enums:", enumVals);

  const missingCols = [
    "enrichment_status",
    "enriched_at",
    "enrichment_error",
    "enrichment_attempts",
  ].filter((c) => !cols.some((r) => r.column_name === c));

  if (missingCols.length || !tables.length) {
    console.error("\nMISSING Phase 2 schema. Run:");
    console.error("  npm run db:migrate:hunter-enrichment");
    console.error("Then restart the app. Companies/Autopilot will 500 until this is done.");
    process.exit(1);
  }
  console.log("\nPhase 2 schema OK.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
