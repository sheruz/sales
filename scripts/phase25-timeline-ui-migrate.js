/**
 * Phase 2.5 — Company timeline + UI support (additive).
 *
 * - CompanyTimelineEventType, TimelineActor enums
 * - company_timeline_events table
 * - Idempotent backfill from companies / emails / contacts
 *
 * Usage:
 *   DRY_RUN=1 npm run db:migrate:phase25-ui
 *   npm run db:migrate:phase25-ui
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
  if (!(await enumExists(client, name))) {
    console.log(`  create enum ${name}`);
    if (!DRY_RUN) {
      const list = values.map((v) => `'${v}'`).join(", ");
      await client.$executeRawUnsafe(
        `CREATE TYPE "${name}" AS ENUM (${list})`
      );
    }
    return;
  }
  console.log(`  skip enum ${name} (exists)`);
  for (const v of values) {
    if (await enumHasValue(client, name, v)) {
      console.log(`  skip enum value ${name}.${v}`);
      continue;
    }
    console.log(`  add enum value ${name}.${v}`);
    if (!DRY_RUN) {
      await client.$executeRawUnsafe(
        `ALTER TYPE "${name}" ADD VALUE IF NOT EXISTS '${v}'`
      );
    }
  }
}

async function insertEvent(client, row) {
  if (DRY_RUN) return;
  await client.$executeRawUnsafe(
    `INSERT INTO company_timeline_events
      (id, organization_id, company_id, contact_id, opportunity_id, type, title, details, actor, user_id, dedupe_key, created_at)
     VALUES ($1,$2,$3,$4,$5,$6::"CompanyTimelineEventType",$7,$8::jsonb,$9::"TimelineActor",$10,$11,$12)
     ON CONFLICT (company_id, dedupe_key) DO NOTHING`,
    row.id,
    row.organizationId,
    row.companyId,
    row.contactId,
    row.opportunityId,
    row.type,
    row.title,
    JSON.stringify(row.details ?? {}),
    row.actor,
    row.userId,
    row.dedupeKey,
    row.createdAt
  );
}

async function main() {
  console.log("Phase 2.5 — timeline UI migrate" + (DRY_RUN ? " (DRY_RUN)" : ""));

  const eventTypes = [
    "SOURCED",
    "CRAWLED",
    "CRAWL_BLOCKED",
    "CRAWL_FAILED",
    "EMAILS_FOUND",
    "ENRICHED",
    "NO_CONTACT",
    "VERIFIED",
    "SKIPPED",
    "UNSKIPPED",
    "NOTE",
    "AUDITED",
    "CONTACTED",
    "REPLIED",
    "MEETING_BOOKED",
    "PROPOSAL_SENT",
    "WON",
    "LOST",
  ];
  await ensureEnum(prisma, "CompanyTimelineEventType", eventTypes);
  await ensureEnum(prisma, "TimelineActor", ["SYSTEM", "AI", "USER"]);

  if (!(await tableExists(prisma, "company_timeline_events"))) {
    console.log("  create table company_timeline_events");
    if (!DRY_RUN) {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE "company_timeline_events" (
          "id" TEXT PRIMARY KEY,
          "organization_id" TEXT NOT NULL,
          "company_id" TEXT NOT NULL,
          "contact_id" TEXT,
          "opportunity_id" TEXT,
          "type" "CompanyTimelineEventType" NOT NULL,
          "title" TEXT NOT NULL,
          "details" JSONB,
          "actor" "TimelineActor" NOT NULL DEFAULT 'SYSTEM',
          "user_id" TEXT,
          "dedupe_key" TEXT,
          "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "company_timeline_events_organization_id_fkey"
            FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "company_timeline_events_company_id_fkey"
            FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "company_timeline_events_contact_id_fkey"
            FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE,
          CONSTRAINT "company_timeline_events_opportunity_id_fkey"
            FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE,
          CONSTRAINT "company_timeline_events_user_id_fkey"
            FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
        )
      `);
      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX "company_timeline_events_company_id_dedupe_key_key"
         ON "company_timeline_events"("company_id", "dedupe_key")`
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX "company_timeline_events_company_id_created_at_idx"
         ON "company_timeline_events"("company_id", "created_at")`
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX "company_timeline_events_organization_id_created_at_idx"
         ON "company_timeline_events"("organization_id", "created_at")`
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX "company_timeline_events_type_idx"
         ON "company_timeline_events"("type")`
      );
    }
  } else {
    console.log("  skip table company_timeline_events");
  }

  if (DRY_RUN && !(await tableExists(prisma, "company_timeline_events"))) {
    console.log("  DRY_RUN: skip backfill (table not created yet)");
    console.log("Phase 2.5 migrate dry-run done.");
    return;
  }

  console.log("  backfill timeline events…");
  const companies = await prisma.company.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      organizationId: true,
      name: true,
      source: true,
      createdAt: true,
      crawlStatus: true,
      crawledAt: true,
      crawlError: true,
      enrichmentStatus: true,
      enrichedAt: true,
      enrichmentError: true,
      metadata: true,
      emails: { select: { email: true, type: true } },
      contacts: {
        select: { id: true, email: true, emailStatus: true, source: true, createdAt: true },
        take: 5,
        orderBy: { createdAt: "asc" },
      },
    },
  });

  let inserted = 0;
  for (const c of companies) {
    const events = [];
    events.push({
      id: randomUUID(),
      organizationId: c.organizationId,
      companyId: c.id,
      contactId: null,
      opportunityId: null,
      type: "SOURCED",
      title: `Found${c.source ? ` via ${c.source}` : ""}`,
      details: { source: c.source },
      actor: "SYSTEM",
      userId: null,
      dedupeKey: "sourced",
      createdAt: c.createdAt,
    });

    if (c.crawlStatus === "DONE" || c.crawledAt) {
      events.push({
        id: randomUUID(),
        organizationId: c.organizationId,
        companyId: c.id,
        contactId: null,
        opportunityId: null,
        type: "CRAWLED",
        title: "Website crawled",
        details: { crawlStatus: c.crawlStatus },
        actor: "SYSTEM",
        userId: null,
        dedupeKey: "crawled",
        createdAt: c.crawledAt || c.createdAt,
      });
    } else if (c.crawlStatus === "BLOCKED") {
      events.push({
        id: randomUUID(),
        organizationId: c.organizationId,
        companyId: c.id,
        contactId: null,
        opportunityId: null,
        type: "CRAWL_BLOCKED",
        title: "Crawl blocked",
        details: { error: c.crawlError },
        actor: "SYSTEM",
        userId: null,
        dedupeKey: "crawl_blocked",
        createdAt: c.crawledAt || c.createdAt,
      });
    } else if (c.crawlStatus === "FAILED") {
      events.push({
        id: randomUUID(),
        organizationId: c.organizationId,
        companyId: c.id,
        contactId: null,
        opportunityId: null,
        type: "CRAWL_FAILED",
        title: "Crawl failed",
        details: { error: c.crawlError },
        actor: "SYSTEM",
        userId: null,
        dedupeKey: "crawl_failed",
        createdAt: c.crawledAt || c.createdAt,
      });
    }

    if (c.emails.length > 0) {
      events.push({
        id: randomUUID(),
        organizationId: c.organizationId,
        companyId: c.id,
        contactId: null,
        opportunityId: null,
        type: "EMAILS_FOUND",
        title: `${c.emails.length} website email(s) found`,
        details: { count: c.emails.length },
        actor: "SYSTEM",
        userId: null,
        dedupeKey: "emails_found",
        createdAt: c.crawledAt || c.createdAt,
      });
    }

    if (c.enrichmentStatus === "ENRICHED" || c.contacts.length > 0) {
      const first = c.contacts[0];
      events.push({
        id: randomUUID(),
        organizationId: c.organizationId,
        companyId: c.id,
        contactId: first?.id ?? null,
        opportunityId: null,
        type: "ENRICHED",
        title: `Enriched — ${c.contacts.length || 1} contact(s)`,
        details: {
          contactCount: c.contacts.length,
          emailStatus: first?.emailStatus,
          source: first?.source,
        },
        actor: "SYSTEM",
        userId: null,
        dedupeKey: "enriched",
        createdAt: c.enrichedAt || first?.createdAt || c.createdAt,
      });
      if (first?.emailStatus === "valid") {
        events.push({
          id: randomUUID(),
          organizationId: c.organizationId,
          companyId: c.id,
          contactId: first.id,
          opportunityId: null,
          type: "VERIFIED",
          title: "Email verified (valid)",
          details: { email: first.email },
          actor: "SYSTEM",
          userId: null,
          dedupeKey: "verified",
          createdAt: c.enrichedAt || first.createdAt,
        });
      }
    } else if (c.enrichmentStatus === "NO_CONTACT") {
      events.push({
        id: randomUUID(),
        organizationId: c.organizationId,
        companyId: c.id,
        contactId: null,
        opportunityId: null,
        type: "NO_CONTACT",
        title: "No contact found",
        details: { error: c.enrichmentError },
        actor: "SYSTEM",
        userId: null,
        dedupeKey: "no_contact",
        createdAt: c.enrichedAt || c.createdAt,
      });
    } else if (c.enrichmentStatus === "SKIPPED") {
      events.push({
        id: randomUUID(),
        organizationId: c.organizationId,
        companyId: c.id,
        contactId: null,
        opportunityId: null,
        type: "SKIPPED",
        title: "Skipped enrichment",
        details: { error: c.enrichmentError },
        actor: "SYSTEM",
        userId: null,
        dedupeKey: "skipped",
        createdAt: c.enrichedAt || c.createdAt,
      });
    }

    for (const e of events) {
      if (DRY_RUN) {
        inserted += 1;
        continue;
      }
      await insertEvent(prisma, e);
      inserted += 1;
    }
  }

  console.log(
    `  backfill ${DRY_RUN ? "would insert ~" : "processed "}${inserted} event rows across ${companies.length} companies`
  );
  console.log("Phase 2.5 migrate done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
