/**
 * Phase 1 tenant isolation proof (Org A vs Org B).
 * Requires DATABASE_URL and applied schema.
 *
 *   node scripts/run-with-env.js npx tsx scripts/phase1-isolation-test.ts
 */
import { PrismaClient } from "@prisma/client";
import { leadService } from "../src/services/lead.service";
import { campaignService } from "../src/services/campaign.service";
import { organizationService } from "../src/services/organization.service";
import { seedRolesAndPermissions } from "../src/lib/tenant/rbac";

const prisma = new PrismaClient();

async function fail(msg: string): Promise<never> {
  console.error("FAIL:", msg);
  process.exit(1);
}

async function main() {
  await seedRolesAndPermissions();

  const suffix = Date.now().toString(36);

  const orgA = await organizationService.createOrganization({
    name: `Isolation A ${suffix}`,
    slug: `iso-a-${suffix}`,
    admin: {
      email: `admin-a-${suffix}@test.local`,
      password: "TestOrg@123",
      firstName: "Admin",
      lastName: "A",
    },
  });

  const orgB = await organizationService.createOrganization({
    name: `Isolation B ${suffix}`,
    slug: `iso-b-${suffix}`,
    admin: {
      email: `admin-b-${suffix}@test.local`,
      password: "TestOrg@123",
      firstName: "Admin",
      lastName: "B",
    },
  });

  const adminA = await prisma.user.findUniqueOrThrow({
    where: { email: `admin-a-${suffix}@test.local` },
  });
  const adminB = await prisma.user.findUniqueOrThrow({
    where: { email: `admin-b-${suffix}@test.local` },
  });

  const leadA = await leadService.create(
    orgA.id,
    {
      firstName: "Prospect",
      lastName: "Alpha",
      email: `prospect-a-${suffix}@example.com`,
      companyName: "Alpha Co",
      source: "Manual",
    },
    adminA.id
  );

  const leadB = await leadService.create(
    orgB.id,
    {
      firstName: "Prospect",
      lastName: "Beta",
      email: `prospect-b-${suffix}@example.com`,
      companyName: "Beta Co",
      source: "Manual",
    },
    adminB.id
  );

  try {
    await leadService.getById(orgA.id, leadB.id);
    await fail("Org A could read Org B lead by ID");
  } catch {
    console.log("OK: Org A cannot get Org B lead by ID");
  }

  try {
    await leadService.getById(orgB.id, leadA.id);
    await fail("Org B could read Org A lead by ID");
  } catch {
    console.log("OK: Org B cannot get Org A lead by ID");
  }

  const searchA = await leadService.list(orgA.id, {
    page: 1,
    limit: 50,
    search: "Prospect",
    sortBy: "createdAt",
    sortOrder: "desc",
  });
  if (searchA.leads.some((l) => l.id === leadB.id)) {
    await fail("Search leaked Org B lead into Org A");
  }
  console.log("OK: search is organization-scoped");

  try {
    await leadService.update(
      orgA.id,
      leadB.id,
      { firstName: "Hacked" },
      adminA.id
    );
    await fail("Org A updated Org B lead");
  } catch {
    console.log("OK: update cannot cross tenants");
  }

  const campaignA = await campaignService.create(orgA.id, {
    name: `Camp A ${suffix}`,
    description: "iso",
    targetCountries: [],
    targetIndustries: [],
    dailyOutreachLimit: 50,
    status: "DRAFT",
  });

  try {
    await campaignService.getById(orgB.id, campaignA.id);
    await fail("Org B could read Org A campaign");
  } catch {
    console.log("OK: campaigns are organization-scoped");
  }

  await prisma.conversation.create({
    data: {
      organizationId: orgA.id,
      leadId: leadA.id,
      channel: "EMAIL",
      subject: "Hello",
      content: "Secret to A only",
      isInbound: false,
    },
  });

  const convB = await prisma.conversation.findMany({
    where: { organizationId: orgB.id },
  });
  if (convB.some((c) => c.leadId === leadA.id)) {
    await fail("Conversation leaked across tenants");
  }
  console.log("OK: conversations are organization-scoped");

  await prisma.organization.update({
    where: { id: orgA.id },
    data: { deletedAt: new Date(), status: "CANCELLED" },
  });
  await prisma.organization.update({
    where: { id: orgB.id },
    data: { deletedAt: new Date(), status: "CANCELLED" },
  });

  console.log("\nPhase 1 isolation tests PASSED");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
