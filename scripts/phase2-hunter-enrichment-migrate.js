/**
 * Phase 2 — Hunter enrichment + cron observability (additive, non-destructive).
 *
 * - Enum ADD VALUE outside interactive txn issues (IF NOT EXISTS, idempotent)
 * - Company enrichment columns
 * - CronTickLog table
 * - Contact duplicate report + merge, then unique (organization_id, normalized_email)
 * - IntegrationPlatform.HUNTER + integration_products seed
 *
 * Usage:
 *   npm run db:migrate:hunter-enrichment
 *   DRY_RUN=1 npm run db:migrate:hunter-enrichment   # report duplicates only
 */
const { randomUUID } = require("crypto");
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

/**
 * Postgres cannot run ADD VALUE inside a transaction block on older versions.
 * Run each ADD VALUE in its own connection / auto-commit via $executeRawUnsafe.
 */
async function ensureEnumValue(client, enumName, value) {
  if (!(await enumExists(client, enumName))) {
    throw new Error(`Enum ${enumName} missing`);
  }
  if (await enumHasValue(client, enumName, value)) {
    console.log(`  skip enum value ${enumName}.${value}`);
    return;
  }
  console.log(`  add enum value ${enumName}.${value} (outside txn)`);
  await client.$executeRawUnsafe(
    `ALTER TYPE "${enumName}" ADD VALUE IF NOT EXISTS '${value}'`
  );
}

async function ensureEnum(client, name, values) {
  if (await enumExists(client, name)) {
    console.log(`  skip enum ${name}`);
    for (const v of values) {
      await ensureEnumValue(client, name, v);
    }
    return;
  }
  console.log(`  create enum ${name}`);
  const list = values.map((v) => `'${v}'`).join(", ");
  await client.$executeRawUnsafe(`CREATE TYPE "${name}" AS ENUM (${list})`);
}

async function ensureColumn(client, table, column, ddl) {
  if (await columnExists(client, table, column)) {
    console.log(`  skip column ${table}.${column}`);
    return;
  }
  console.log(`  add column ${table}.${column}`);
  await client.$executeRawUnsafe(`ALTER TABLE "${table}" ADD COLUMN ${ddl}`);
}

async function reportAndMergeContactDuplicates(client) {
  console.log("  contact duplicate scan (org + lower(email))…");
  const dupes = await client.$queryRawUnsafe(`
    SELECT organization_id, lower(trim(email)) AS email_key, count(*)::int AS cnt,
           array_agg(id ORDER BY created_at ASC) AS ids
    FROM contacts
    WHERE email IS NOT NULL AND trim(email) <> ''
    GROUP BY organization_id, lower(trim(email))
    HAVING count(*) > 1
  `);

  if (!Array.isArray(dupes) || dupes.length === 0) {
    console.log("  no duplicate emails per org");
    return 0;
  }

  console.log(`  found ${dupes.length} duplicate email group(s):`);
  for (const g of dupes.slice(0, 50)) {
    console.log(
      `    org=${g.organization_id} email=${g.email_key} count=${g.cnt}`
    );
  }
  if (dupes.length > 50) console.log(`    …and ${dupes.length - 50} more`);

  if (DRY_RUN) {
    console.log("  DRY_RUN=1 — skip merge / unique index");
    return dupes.length;
  }

  for (const g of dupes) {
    const ids = g.ids;
    if (!Array.isArray(ids) || ids.length < 2) continue;
    const keeper = ids[0];
    const losers = ids.slice(1);
    for (const loser of losers) {
      await client.$executeRawUnsafe(
        `UPDATE opportunities SET primary_contact_id = $1 WHERE primary_contact_id = $2`,
        keeper,
        loser
      );
      await client.$executeRawUnsafe(
        `UPDATE opportunities SET recommended_contact_id = $1 WHERE recommended_contact_id = $2`,
        keeper,
        loser
      );
      await client.$executeRawUnsafe(
        `UPDATE deals SET primary_contact_id = $1 WHERE primary_contact_id = $2`,
        keeper,
        loser
      );
      await client.$executeRawUnsafe(
        `UPDATE inbox_conversations SET contact_id = $1 WHERE contact_id = $2`,
        keeper,
        loser
      );
      await client.$executeRawUnsafe(
        `UPDATE sequence_enrollments SET contact_id = $1 WHERE contact_id = $2`,
        keeper,
        loser
      );
      await client.$executeRawUnsafe(
        `UPDATE tasks SET contact_id = $1 WHERE contact_id = $2`,
        keeper,
        loser
      );
      await client.$executeRawUnsafe(
        `UPDATE meetings SET contact_id = $1 WHERE contact_id = $2`,
        keeper,
        loser
      );
      await client.$executeRawUnsafe(
        `UPDATE proposals SET contact_id = $1 WHERE contact_id = $2`,
        keeper,
        loser
      );
      await client.$executeRawUnsafe(`DELETE FROM contacts WHERE id = $1`, loser);
      console.log(`  merged contact ${loser} → ${keeper}`);
    }
  }
  return dupes.length;
}

async function main() {
  console.log("Phase 2 — Hunter enrichment migrate" + (DRY_RUN ? " (DRY_RUN)" : ""));

  // Enum values MUST be outside a multi-statement transaction
  await ensureEnumValue(prisma, "IntegrationPlatform", "HUNTER");
  await ensureEnumValue(prisma, "OpportunityStage", "SOURCED");
  await ensureEnum(prisma, "CompanyEnrichmentStatus", [
    "PENDING",
    "ENRICHED",
    "NO_CONTACT",
    "SKIPPED",
    "FAILED",
  ]);

  if (await tableExists(prisma, "companies")) {
    await ensureColumn(
      prisma,
      "companies",
      "enrichment_status",
      `"enrichment_status" "CompanyEnrichmentStatus"`
    );
    await ensureColumn(
      prisma,
      "companies",
      "enriched_at",
      `"enriched_at" TIMESTAMP(3)`
    );
    await ensureColumn(
      prisma,
      "companies",
      "enrichment_error",
      `"enrichment_error" TEXT`
    );
    await ensureColumn(
      prisma,
      "companies",
      "enrichment_attempts",
      `"enrichment_attempts" INTEGER NOT NULL DEFAULT 0`
    );
    if (!(await indexExists(prisma, "companies_organization_id_enrichment_status_idx"))) {
      console.log("  create index companies enrichment_status");
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "companies_organization_id_enrichment_status_idx"
         ON "companies"("organization_id", "enrichment_status")`
      );
    }
  }

  if (!(await tableExists(prisma, "cron_tick_logs"))) {
    console.log("  create table cron_tick_logs");
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "cron_tick_logs" (
        "id" TEXT PRIMARY KEY,
        "organization_id" TEXT,
        "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "finished_at" TIMESTAMP(3),
        "ok" BOOLEAN NOT NULL DEFAULT true,
        "skipped" BOOLEAN NOT NULL DEFAULT false,
        "skip_reason" TEXT,
        "jobs" JSONB,
        "counts" JSONB,
        "errors" JSONB,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "cron_tick_logs_organization_id_fkey"
          FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "cron_tick_logs_started_at_idx" ON "cron_tick_logs"("started_at")`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "cron_tick_logs_organization_id_started_at_idx"
       ON "cron_tick_logs"("organization_id", "started_at")`
    );
  } else {
    console.log("  skip table cron_tick_logs");
  }

  // Backfill normalized_email
  if (await tableExists(prisma, "contacts")) {
    console.log("  backfill contacts.normalized_email");
    await prisma.$executeRawUnsafe(`
      UPDATE contacts
      SET normalized_email = lower(trim(email))
      WHERE email IS NOT NULL AND trim(email) <> ''
        AND (normalized_email IS NULL OR normalized_email <> lower(trim(email)))
    `);

    const dupeGroups = await reportAndMergeContactDuplicates(prisma);

    if (!DRY_RUN) {
      if (await indexExists(prisma, "contacts_organization_id_normalized_email_idx")) {
        console.log("  drop non-unique index contacts_organization_id_normalized_email_idx");
        await prisma.$executeRawUnsafe(
          `DROP INDEX IF EXISTS "contacts_organization_id_normalized_email_idx"`
        );
      }
      if (!(await indexExists(prisma, "contacts_org_normalized_email_key"))) {
        console.log("  create unique contacts_org_normalized_email_key");
        await prisma.$executeRawUnsafe(`
          CREATE UNIQUE INDEX "contacts_org_normalized_email_key"
          ON "contacts"("organization_id", "normalized_email")
        `);
      } else {
        console.log("  skip unique contacts_org_normalized_email_key");
      }
    } else if (dupeGroups > 0) {
      console.log("  re-run without DRY_RUN after reviewing duplicates");
    }
  }

  // Seed Hunter product
  if (await tableExists(prisma, "integration_products")) {
    const existing = await prisma.$queryRawUnsafe(
      `SELECT 1 FROM integration_products WHERE platform = 'HUNTER'::"IntegrationPlatform" LIMIT 1`
    );
    if (!Array.isArray(existing) || existing.length === 0) {
      console.log("  seed integration_products HUNTER");
      await prisma.$executeRawUnsafe(
        `INSERT INTO integration_products
         (id, platform, name, description, monthly_price_cents, is_active, sort_order, created_at, updated_at)
         VALUES ($1, 'HUNTER'::"IntegrationPlatform", $2, $3, 0, true, 6, NOW(), NOW())`,
        randomUUID(),
        "Hunter.io",
        "Find and verify decision-maker emails by company domain (BYOK)."
      );
    } else {
      console.log("  skip integration_products HUNTER");
    }
  }

  console.log("Phase 2 migrate done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
