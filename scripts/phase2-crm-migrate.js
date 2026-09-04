/**
 * Phase 2 CRM — controlled, non-destructive schema hardening.
 *
 * Goals:
 *   - Add companies.normalized_domain (nullable)
 *   - Add contacts.normalized_email (nullable)
 *   - Backfill from existing domain/website/email
 *   - Create supporting indexes (idempotent)
 *   - REPORT duplicate domains within an org (do not delete/merge)
 *   - NEVER delete rows
 *   - Idempotent / fail-closed on unexpected errors
 *
 * Does NOT run prisma db push.
 *
 * Usage (local/staging with DATABASE_URL — NOT production until approved):
 *   npm run db:migrate:crm
 */
const { PrismaClient } = require("@prisma/client");
require("./load-env");

const prisma = new PrismaClient();

class MigrationAbortError extends Error {
  constructor(message) {
    super(message);
    this.name = "MigrationAbortError";
  }
}

async function tableExists(client, table) {
  const rows = await client.$queryRawUnsafe(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1
     LIMIT 1`,
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
    `SELECT 1 FROM pg_indexes
     WHERE schemaname = 'public' AND indexname = $1
     LIMIT 1`,
    indexName
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function ensureColumn(client, table, column, addDdl) {
  if (await columnExists(client, table, column)) {
    console.log(`  skip column ${table}.${column} (exists)`);
    return false;
  }
  console.log(`  add column ${table}.${column}`);
  await client.$executeRawUnsafe(addDdl);
  return true;
}

async function ensureIndex(client, indexName, createDdl) {
  if (await indexExists(client, indexName)) {
    console.log(`  skip index ${indexName} (exists)`);
    return false;
  }
  console.log(`  create index ${indexName}`);
  await client.$executeRawUnsafe(createDdl);
  return true;
}

function normalizeDomainSqlExpr(domainCol, websiteCol) {
  // Best-effort lowercase host without protocol/www — applied in SQL backfill.
  return `
    NULLIF(
      LOWER(
        REGEXP_REPLACE(
          REGEXP_REPLACE(
            COALESCE(NULLIF(TRIM(${domainCol}), ''), NULLIF(TRIM(${websiteCol}), '')),
            '^https?://',
            '',
            'i'
          ),
          '^www\\.',
          '',
          'i'
        )
      ),
      ''
    )
  `;
}

async function main() {
  console.log("Phase 2 CRM migrate — start");
  const countsBefore = {};

  if (!(await tableExists(prisma, "companies"))) {
    throw new MigrationAbortError("companies table missing");
  }
  if (!(await tableExists(prisma, "contacts"))) {
    throw new MigrationAbortError("contacts table missing");
  }

  const companyCount = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS c FROM companies WHERE deleted_at IS NULL`
  );
  const contactCount = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS c FROM contacts`
  );
  countsBefore.companies = companyCount[0]?.c ?? 0;
  countsBefore.contacts = contactCount[0]?.c ?? 0;
  console.log(
    `  row counts before: companies=${countsBefore.companies} contacts=${countsBefore.contacts}`
  );

  console.log("\n1) Schema columns");
  await ensureColumn(
    prisma,
    "companies",
    "normalized_domain",
    `ALTER TABLE companies ADD COLUMN normalized_domain TEXT`
  );
  await ensureColumn(
    prisma,
    "contacts",
    "normalized_email",
    `ALTER TABLE contacts ADD COLUMN normalized_email TEXT`
  );

  console.log("\n2) Backfill (non-destructive)");
  const domainExpr = normalizeDomainSqlExpr("domain", "website");
  // Strip path after host for website-derived values
  const backfillCompanies = await prisma.$executeRawUnsafe(`
    UPDATE companies
    SET normalized_domain = SPLIT_PART(${domainExpr}, '/', 1)
    WHERE normalized_domain IS NULL
      AND (
        (domain IS NOT NULL AND TRIM(domain) <> '')
        OR (website IS NOT NULL AND TRIM(website) <> '')
      )
  `);
  console.log(`  companies normalized_domain backfilled: ${backfillCompanies}`);

  const backfillContacts = await prisma.$executeRawUnsafe(`
    UPDATE contacts
    SET normalized_email = LOWER(TRIM(email))
    WHERE normalized_email IS NULL
      AND email IS NOT NULL
      AND TRIM(email) <> ''
  `);
  console.log(`  contacts normalized_email backfilled: ${backfillContacts}`);

  console.log("\n3) Indexes");
  await ensureIndex(
    prisma,
    "companies_organization_id_normalized_domain_idx",
    `CREATE INDEX companies_organization_id_normalized_domain_idx
     ON companies (organization_id, normalized_domain)`
  );
  await ensureIndex(
    prisma,
    "contacts_organization_id_normalized_email_idx",
    `CREATE INDEX contacts_organization_id_normalized_email_idx
     ON contacts (organization_id, normalized_email)`
  );
  await ensureIndex(
    prisma,
    "contacts_organization_id_company_id_normalized_email_idx",
    `CREATE INDEX contacts_organization_id_company_id_normalized_email_idx
     ON contacts (organization_id, company_id, normalized_email)`
  );

  console.log("\n4) Duplicate domain report (no auto-merge)");
  const dupDomains = await prisma.$queryRawUnsafe(`
    SELECT organization_id, normalized_domain, COUNT(*)::int AS cnt
    FROM companies
    WHERE deleted_at IS NULL
      AND normalized_domain IS NOT NULL
      AND normalized_domain <> ''
    GROUP BY organization_id, normalized_domain
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC
    LIMIT 50
  `);
  if (!dupDomains.length) {
    console.log("  no duplicate normalized_domain within org");
  } else {
    console.log(
      `  WARNING: ${dupDomains.length} duplicate normalized_domain group(s) (showing up to 50)`
    );
    for (const row of dupDomains) {
      console.log(
        `    org=${row.organization_id} domain=${row.normalized_domain} count=${row.cnt}`
      );
    }
    console.log(
      "  Unique constraint on (organization_id, normalized_domain) NOT applied — resolve duplicates manually in a later phase."
    );
  }

  // Existing unique on (organization_id, domain) is already in schema; do not add destructive unique on normalized_domain.

  const companyCountAfter = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS c FROM companies WHERE deleted_at IS NULL`
  );
  const contactCountAfter = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS c FROM contacts`
  );
  const countsAfter = {
    companies: companyCountAfter[0]?.c ?? 0,
    contacts: contactCountAfter[0]?.c ?? 0,
  };

  if (
    countsAfter.companies !== countsBefore.companies ||
    countsAfter.contacts !== countsBefore.contacts
  ) {
    throw new MigrationAbortError(
      `Row count changed unexpectedly: before=${JSON.stringify(countsBefore)} after=${JSON.stringify(countsAfter)}`
    );
  }

  console.log("\n5) Validation OK");
  console.log(
    `  row counts after: companies=${countsAfter.companies} contacts=${countsAfter.contacts}`
  );
  console.log("Phase 2 CRM migrate — complete (no deletes)");
}

main()
  .catch((err) => {
    console.error("\nPhase 2 CRM migrate FAILED:", err.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
