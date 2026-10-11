/**
 * Phase 0 — Lead → Company/Contact migration preview / execute.
 *
 * Default: DRY-RUN (no writes). Shows counts only.
 * Execute only with --execute --organizationId=<uuid> after explicit approval.
 *
 * Usage:
 *   npm run db:migrate:phase0-leads -- --dry-run
 *   npm run db:migrate:phase0-leads -- --dry-run --organizationId=<uuid>
 *   npm run db:migrate:phase0-leads -- --execute --organizationId=<uuid>
 */
const { PrismaClient } = require("@prisma/client");
require("./load-env");

const prisma = new PrismaClient();

function parseArgs(argv) {
  const flags = new Set();
  const opts = {};
  for (const a of argv) {
    if (a.startsWith("--organizationId=")) {
      opts.organizationId = a.slice("--organizationId=".length);
    } else if (a.startsWith("--")) {
      flags.add(a.slice(2));
    }
  }
  return { flags, opts };
}

function domainFromWebsite(website) {
  if (!website) return null;
  try {
    const u = new URL(
      website.startsWith("http") ? website : `https://${website}`
    );
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

async function analyzeLead(organizationId, lead) {
  const result = {
    companyAction: "skip",
    contactAction: "skip",
    opportunityAction: "none",
  };

  let companyId = lead.companyId;
  if (companyId) {
    const owned = await prisma.company.findFirst({
      where: { id: companyId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!owned) companyId = null;
  }

  if (companyId) {
    result.companyAction = "reuse_linked";
  } else {
    const companyName =
      lead.companyName?.trim() ||
      lead.fullName?.trim() ||
      lead.email?.split("@")[1] ||
      "Unknown company";
    const domain = domainFromWebsite(lead.companyWebsite);

    let existing = null;
    if (domain) {
      existing = await prisma.company.findFirst({
        where: {
          organizationId,
          deletedAt: null,
          OR: [
            { domain: { equals: domain, mode: "insensitive" } },
            { website: { contains: domain, mode: "insensitive" } },
          ],
        },
        select: { id: true },
      });
    }
    if (!existing && companyName) {
      existing = await prisma.company.findFirst({
        where: {
          organizationId,
          deletedAt: null,
          name: { equals: companyName, mode: "insensitive" },
        },
        select: { id: true },
      });
    }

    result.companyAction = existing ? "reuse_match" : "create";
  }

  if (lead.contact) {
    result.contactAction = "reuse_linked";
  } else if (lead.firstName || lead.email) {
    if (lead.email) {
      const byEmail = await prisma.contact.findFirst({
        where: {
          organizationId,
          email: { equals: lead.email, mode: "insensitive" },
        },
        select: { id: true },
      });
      result.contactAction = byEmail ? "reuse_email" : "create";
    } else {
      result.contactAction = "create";
    }
  } else {
    result.contactAction = "skip";
  }

  result.opportunityAction = lead.opportunity ? "link_existing" : "none";
  return result;
}

async function executeBridge(organizationId, leadId) {
  const { leadMigrationService } = await import(
    "../src/services/lead-migration.service.ts"
  );
  return leadMigrationService.bridgeLead(organizationId, leadId);
}

async function main() {
  const { flags, opts } = parseArgs(process.argv.slice(2));
  const dryRun = flags.has("dry-run") || !flags.has("execute");
  const organizationId = opts.organizationId || null;

  console.log("Phase 0 — active Lead → Company/Contact migration");
  console.log(`  mode: ${dryRun ? "DRY-RUN (no writes)" : "EXECUTE"}`);
  if (organizationId) console.log(`  organizationId: ${organizationId}`);

  if (!dryRun && !organizationId) {
    console.error(
      "Refuse --execute without --organizationId=... (scope to one org)."
    );
    process.exitCode = 1;
    return;
  }

  const leads = await prisma.lead.findMany({
    where: {
      deletedAt: null,
      ...(organizationId ? { organizationId } : {}),
    },
    include: {
      contact: { select: { id: true } },
      opportunity: { select: { id: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const summary = {
    leadsFound: leads.length,
    companiesWouldCreate: 0,
    companiesWouldReuse: 0,
    contactsWouldCreate: 0,
    contactsWouldReuse: 0,
    contactsSkipped: 0,
    opportunitiesExistingLinked: 0,
    opportunitiesWouldCreate: 0,
    duplicatesSkipped: 0,
    executedBridged: 0,
    executedErrors: 0,
  };

  const byOrg = new Map();

  for (const lead of leads) {
    const analysis = await analyzeLead(lead.organizationId, lead);
    byOrg.set(
      lead.organizationId,
      (byOrg.get(lead.organizationId) || 0) + 1
    );

    if (analysis.companyAction === "create") summary.companiesWouldCreate += 1;
    else summary.companiesWouldReuse += 1;

    if (analysis.contactAction === "create") summary.contactsWouldCreate += 1;
    else if (analysis.contactAction === "skip") summary.contactsSkipped += 1;
    else summary.contactsWouldReuse += 1;

    if (analysis.opportunityAction === "link_existing") {
      summary.opportunitiesExistingLinked += 1;
    }

    if (
      analysis.companyAction === "reuse_linked" &&
      (analysis.contactAction === "reuse_linked" ||
        analysis.contactAction === "skip")
    ) {
      summary.duplicatesSkipped += 1;
    }

    if (!dryRun) {
      try {
        await executeBridge(lead.organizationId, lead.id);
        summary.executedBridged += 1;
      } catch (err) {
        summary.executedErrors += 1;
        console.error(
          `  error lead=${lead.id}:`,
          err instanceof Error ? err.message : err
        );
      }
    }
  }

  console.log("\n=== COUNTS ===");
  console.log(`  leadsFound:                         ${summary.leadsFound}`);
  console.log(
    `  companiesWouldCreate:               ${summary.companiesWouldCreate}`
  );
  console.log(
    `  companiesWouldReuse:                ${summary.companiesWouldReuse}`
  );
  console.log(
    `  contactsWouldCreate:                ${summary.contactsWouldCreate}`
  );
  console.log(
    `  contactsWouldReuse:                 ${summary.contactsWouldReuse}`
  );
  console.log(
    `  contactsSkipped (no person data):   ${summary.contactsSkipped}`
  );
  console.log(
    `  opportunitiesExistingLinked:        ${summary.opportunitiesExistingLinked}`
  );
  console.log(
    `  opportunitiesWouldCreate:           ${summary.opportunitiesWouldCreate} (bridge never auto-creates opps)`
  );
  console.log(
    `  duplicatesSkipped (already bridged): ${summary.duplicatesSkipped}`
  );
  console.log("\n  By organization:");
  for (const [orgId, count] of byOrg) {
    console.log(`    ${orgId}: ${count} leads`);
  }

  if (dryRun) {
    console.log(
      "\nDRY-RUN complete — no data written. Confirm in chat before --execute."
    );
  } else {
    console.log("\nEXECUTE summary:");
    console.log(`  bridged: ${summary.executedBridged}`);
    console.log(`  errors:  ${summary.executedErrors}`);
  }
}

main()
  .catch((err) => {
    console.error("Phase 0 migrate failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
