/**
 * PoW2 — starter_offers, case_studies, pitch PoW columns, contact.email_source,
 * outreach_sequences.is_proof_of_work.
 *
 * Usage:
 *   DRY_RUN=1 node scripts/run-with-env.js node scripts/pow2-migrate.js
 *   node scripts/run-with-env.js node scripts/pow2-migrate.js
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

async function exec(sql) {
  console.log(`  ${DRY_RUN ? "DRY " : ""}${sql.split("\n")[0]}…`);
  if (!DRY_RUN) await prisma.$executeRawUnsafe(sql);
}

async function main() {
  console.log(`PoW2 migrate${DRY_RUN ? " (DRY_RUN)" : ""}`);

  if (!(await tableExists(prisma, "starter_offers"))) {
    await exec(`
      CREATE TABLE "starter_offers" (
        "id" TEXT PRIMARY KEY,
        "organization_id" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
        "name" TEXT NOT NULL,
        "price" DECIMAL(14,2) NOT NULL,
        "currency" TEXT NOT NULL DEFAULT 'USD',
        "delivery_days" INTEGER NOT NULL,
        "includes" TEXT NOT NULL,
        "finding_types" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
        "status" "OfferStatus" NOT NULL DEFAULT 'ACTIVE',
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } else {
    console.log("  skip starter_offers");
  }
  if (!(await indexExists(prisma, "starter_offers_organization_id_idx"))) {
    await exec(
      `CREATE INDEX "starter_offers_organization_id_idx" ON "starter_offers"("organization_id")`
    );
  }
  if (!(await indexExists(prisma, "starter_offers_status_idx"))) {
    await exec(
      `CREATE INDEX "starter_offers_status_idx" ON "starter_offers"("status")`
    );
  }

  if (!(await tableExists(prisma, "case_studies"))) {
    await exec(`
      CREATE TABLE "case_studies" (
        "id" TEXT PRIMARY KEY,
        "organization_id" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
        "client_type" TEXT NOT NULL,
        "problem" TEXT NOT NULL,
        "what_built" TEXT NOT NULL,
        "result" TEXT NOT NULL,
        "status" "OfferStatus" NOT NULL DEFAULT 'ACTIVE',
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } else {
    console.log("  skip case_studies");
  }
  if (!(await indexExists(prisma, "case_studies_organization_id_idx"))) {
    await exec(
      `CREATE INDEX "case_studies_organization_id_idx" ON "case_studies"("organization_id")`
    );
  }
  if (!(await indexExists(prisma, "case_studies_status_idx"))) {
    await exec(
      `CREATE INDEX "case_studies_status_idx" ON "case_studies"("status")`
    );
  }

  if (!(await columnExists(prisma, "pitches", "kind"))) {
    await exec(
      `ALTER TABLE "pitches" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'legacy'`
    );
  }
  if (!(await columnExists(prisma, "pitches", "pow_draft"))) {
    await exec(`ALTER TABLE "pitches" ADD COLUMN "pow_draft" JSONB`);
  }
  if (!(await columnExists(prisma, "pitches", "pow_stale_at"))) {
    await exec(`ALTER TABLE "pitches" ADD COLUMN "pow_stale_at" TIMESTAMP(3)`);
  }
  if (!(await columnExists(prisma, "pitches", "pow_starter_offer_id"))) {
    await exec(
      `ALTER TABLE "pitches" ADD COLUMN "pow_starter_offer_id" TEXT REFERENCES "starter_offers"("id") ON DELETE SET NULL`
    );
  }
  if (!(await indexExists(prisma, "pitches_kind_idx"))) {
    await exec(`CREATE INDEX "pitches_kind_idx" ON "pitches"("kind")`);
  }

  if (!(await columnExists(prisma, "contacts", "email_source"))) {
    await exec(`ALTER TABLE "contacts" ADD COLUMN "email_source" TEXT`);
  }

  if (!(await columnExists(prisma, "outreach_sequences", "is_proof_of_work"))) {
    await exec(
      `ALTER TABLE "outreach_sequences" ADD COLUMN "is_proof_of_work" BOOLEAN NOT NULL DEFAULT false`
    );
  }
  if (
    !(await indexExists(
      prisma,
      "outreach_sequences_organization_id_is_proof_of_work_idx"
    ))
  ) {
    await exec(
      `CREATE INDEX "outreach_sequences_organization_id_is_proof_of_work_idx" ON "outreach_sequences"("organization_id", "is_proof_of_work")`
    );
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
