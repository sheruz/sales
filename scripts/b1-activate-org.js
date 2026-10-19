/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * One-shot: activate an org on a plan version (manual).
 * Usage: node scripts/b1-activate-org.js "Ok" STARTER
 */
require("./load-env");
const { ensureDatabaseUrl } = require("./database-url");
ensureDatabaseUrl();
const { PrismaClient } = require("@prisma/client");

const orgName = process.argv[2] || "Ok";
const planCode = (process.argv[3] || "STARTER").toUpperCase();

async function main() {
  const prisma = new PrismaClient();
  try {
    const org = await prisma.organization.findFirst({
      where: { name: orgName, deletedAt: null },
    });
    if (!org) {
      console.error(JSON.stringify({ ok: false, error: `Org not found: ${orgName}` }));
      process.exitCode = 1;
      return;
    }

    const plan = await prisma.plan.findFirst({
      where: {
        OR: [{ code: planCode }, { name: planCode }],
        archivedAt: null,
      },
    });
    if (!plan?.currentVersionId) {
      console.error(
        JSON.stringify({
          ok: false,
          error: `Plan ${planCode} missing or no currentVersionId`,
        })
      );
      process.exitCode = 1;
      return;
    }

    const now = new Date();
    const periodEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
    );

    const sub = await prisma.subscription.upsert({
      where: { organizationId: org.id },
      create: {
        organizationId: org.id,
        planId: plan.id,
        planVersionId: plan.currentVersionId,
        provider: "internal",
        accessMode: "manual",
        status: "ACTIVE",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
      update: {
        planId: plan.id,
        planVersionId: plan.currentVersionId,
        pendingPlanVersionId: null,
        pendingApplyAt: null,
        provider: "internal",
        accessMode: "manual",
        status: "ACTIVE",
        trialEndsAt: null,
        gracePeriodEndsAt: null,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        canceledAt: null,
        readOnlyUntil: null,
      },
    });

    if (org.status === "INVITED") {
      await prisma.organization.update({
        where: { id: org.id },
        data: { status: "ACTIVE" },
      });
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          organizationId: org.id,
          name: org.name,
          planCode: plan.code,
          planVersionId: plan.currentVersionId,
          subscriptionStatus: sub.status,
          accessMode: "manual",
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e.message }));
  process.exitCode = 1;
});
