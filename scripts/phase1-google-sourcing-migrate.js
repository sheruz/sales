/**
 * Phase 1 — Google business sourcing (additive, non-destructive).
 *
 * Adds:
 *   - IntegrationPlatform.GOOGLE_PLACES
 *   - SearchQueryStatus, CompanyCrawlStatus, CompanyEmailType enums
 *   - companies.google_place_id, phone, address, crawl_* columns
 *   - company_emails, search_queries, api_usage_logs tables
 *   - unique index on (organization_id, google_place_id) where not null
 *   - integration_products row for GOOGLE_PLACES
 *
 * Usage:
 *   npm run db:migrate:google-sourcing
 */
const { randomUUID } = require("crypto");
const { PrismaClient } = require("@prisma/client");
require("./load-env");

const prisma = new PrismaClient();

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

async function ensureEnum(client, name, values) {
  if (await enumExists(client, name)) {
    console.log(`  skip enum ${name}`);
    return;
  }
  console.log(`  create enum ${name}`);
  const list = values.map((v) => `'${v}'`).join(", ");
  await client.$executeRawUnsafe(`CREATE TYPE "${name}" AS ENUM (${list})`);
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
  await client.$executeRawUnsafe(
    `ALTER TYPE "${enumName}" ADD VALUE IF NOT EXISTS '${value}'`
  );
}

async function ensureColumn(client, table, column, ddl) {
  if (await columnExists(client, table, column)) {
    console.log(`  skip column ${table}.${column}`);
    return;
  }
  console.log(`  add column ${table}.${column}`);
  await client.$executeRawUnsafe(
    `ALTER TABLE "${table}" ADD COLUMN ${ddl}`
  );
}

async function main() {
  console.log("Phase 1 — Google sourcing migrate");

  await ensureEnumValue(prisma, "IntegrationPlatform", "GOOGLE_PLACES");
  await ensureEnum(prisma, "SearchQueryStatus", ["ACTIVE", "PAUSED", "DONE"]);
  await ensureEnum(prisma, "CompanyCrawlStatus", [
    "PENDING",
    "DONE",
    "FAILED",
    "BLOCKED",
  ]);
  await ensureEnum(prisma, "CompanyEmailType", ["GENERIC", "PERSONAL"]);

  if (await tableExists(prisma, "companies")) {
    await ensureColumn(
      prisma,
      "companies",
      "google_place_id",
      `"google_place_id" TEXT`
    );
    await ensureColumn(prisma, "companies", "phone", `"phone" TEXT`);
    await ensureColumn(prisma, "companies", "address", `"address" TEXT`);
    await ensureColumn(
      prisma,
      "companies",
      "crawl_status",
      `"crawl_status" "CompanyCrawlStatus"`
    );
    await ensureColumn(
      prisma,
      "companies",
      "crawled_at",
      `"crawled_at" TIMESTAMP(3)`
    );
    await ensureColumn(
      prisma,
      "companies",
      "crawl_error",
      `"crawl_error" TEXT`
    );

    if (!(await indexExists(prisma, "companies_org_place_id_uidx"))) {
      console.log("  create unique index companies_org_place_id_uidx");
      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX "companies_org_place_id_uidx"
        ON "companies" ("organization_id", "google_place_id")
        WHERE "google_place_id" IS NOT NULL
      `);
    } else {
      console.log("  skip index companies_org_place_id_uidx");
    }

    if (!(await indexExists(prisma, "companies_organization_id_crawl_status_idx"))) {
      console.log("  create index companies_organization_id_crawl_status_idx");
      await prisma.$executeRawUnsafe(`
        CREATE INDEX "companies_organization_id_crawl_status_idx"
        ON "companies" ("organization_id", "crawl_status")
      `);
    }
  }

  if (!(await tableExists(prisma, "company_emails"))) {
    console.log("  create table company_emails");
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "company_emails" (
        "id" TEXT PRIMARY KEY,
        "organization_id" TEXT NOT NULL,
        "company_id" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "source_page" TEXT,
        "type" "CompanyEmailType" NOT NULL DEFAULT 'GENERIC',
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "company_emails_organization_id_fkey"
          FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "company_emails_company_id_fkey"
          FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX "company_emails_company_id_email_key"
      ON "company_emails" ("company_id", "email")
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX "company_emails_organization_id_idx"
      ON "company_emails" ("organization_id")
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX "company_emails_organization_id_email_idx"
      ON "company_emails" ("organization_id", "email")
    `);
  } else {
    console.log("  skip table company_emails");
  }

  if (!(await tableExists(prisma, "search_queries"))) {
    console.log("  create table search_queries");
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "search_queries" (
        "id" TEXT PRIMARY KEY,
        "organization_id" TEXT NOT NULL,
        "query" TEXT NOT NULL,
        "country" TEXT,
        "city" TEXT,
        "status" "SearchQueryStatus" NOT NULL DEFAULT 'ACTIVE',
        "last_run_at" TIMESTAMP(3),
        "results_count" INTEGER NOT NULL DEFAULT 0,
        "page_token" TEXT,
        "last_error" TEXT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "search_queries_organization_id_fkey"
          FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX "search_queries_organization_id_status_idx"
      ON "search_queries" ("organization_id", "status")
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX "search_queries_organization_id_last_run_at_idx"
      ON "search_queries" ("organization_id", "last_run_at")
    `);
  } else {
    console.log("  skip table search_queries");
  }

  if (!(await tableExists(prisma, "api_usage_logs"))) {
    console.log("  create table api_usage_logs");
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "api_usage_logs" (
        "id" TEXT PRIMARY KEY,
        "organization_id" TEXT NOT NULL,
        "provider" TEXT NOT NULL,
        "operation" TEXT NOT NULL,
        "estimated_cost_usd" DECIMAL(12,6) NOT NULL,
        "units" INTEGER NOT NULL DEFAULT 1,
        "metadata" JSONB,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "api_usage_logs_organization_id_fkey"
          FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX "api_usage_logs_organization_id_created_at_idx"
      ON "api_usage_logs" ("organization_id", "created_at")
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX "api_usage_logs_organization_id_provider_created_at_idx"
      ON "api_usage_logs" ("organization_id", "provider", "created_at")
    `);
  } else {
    console.log("  skip table api_usage_logs");
  }

  if (await tableExists(prisma, "integration_products")) {
    const existing = await prisma.$queryRawUnsafe(
      `SELECT 1 FROM integration_products WHERE platform = 'GOOGLE_PLACES'::"IntegrationPlatform" LIMIT 1`
    );
    if (!Array.isArray(existing) || existing.length === 0) {
      console.log("  seed integration_products GOOGLE_PLACES");
      await prisma.$executeRawUnsafe(
        `INSERT INTO integration_products
          (id, platform, name, description, monthly_price_cents, is_active, sort_order, created_at, updated_at)
         VALUES ($1, 'GOOGLE_PLACES'::"IntegrationPlatform", $2, $3, 0, true, 5, NOW(), NOW())`,
        randomUUID(),
        "Google Places",
        "Places API (New) Text Search for Autopilot business sourcing. Billed by Google."
      );
    } else {
      console.log("  skip integration_products GOOGLE_PLACES");
    }
  }

  console.log("Phase 1 migrate complete");
}

main()
  .catch((err) => {
    console.error("Phase 1 migrate failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
