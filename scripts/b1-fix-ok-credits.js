/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * One-shot: top Ok (or named org) up to Growth monthly credits after a missed upgrade grant.
 *   node scripts/b1-fix-ok-credits.js
 *   node scripts/b1-fix-ok-credits.js "Ok"
 */
require("./load-env");
const { ensureDatabaseUrl } = require("./database-url");
ensureDatabaseUrl();
const { PrismaClient } = require("@prisma/client");
const { randomUUID } = require("crypto");

const orgName = process.argv[2] || "Ok";

async function main() {
  const prisma = new PrismaClient();
  try {
    const org = await prisma.organization.findFirst({
      where: { name: orgName, deletedAt: null },
      include: {
        subscriptions: {
          include: { planVersion: true, plan: true },
        },
      },
    });
    if (!org) {
      console.error(JSON.stringify({ ok: false, error: "org not found" }));
      process.exitCode = 1;
      return;
    }
    const sub = org.subscriptions[0];
    const monthly =
      sub?.planVersion?.monthlyCredits ?? sub?.plan?.monthlyCredits ?? 0;
    const balance = org.creditBalanceCached ?? 0;
    const need = Math.max(0, monthly - balance);
    if (need === 0) {
      console.log(
        JSON.stringify({
          ok: true,
          skipped: true,
          balance,
          monthly,
          message: "already at or above monthly allotment",
        })
      );
      return;
    }
    const balanceAfter = balance + need;
    const key = `plan_upgrade_fix:${org.id}:${sub?.planVersionId ?? "x"}:${new Date().toISOString().slice(0, 10)}`;
    await prisma.$transaction(async (tx) => {
      await tx.organization.update({
        where: { id: org.id },
        data: { creditBalanceCached: balanceAfter },
      });
      await tx.creditLedgerEntry.create({
        data: {
          id: randomUUID(),
          organizationId: org.id,
          type: "GRANT_PLAN",
          amount: need,
          balanceAfter,
          idempotencyKey: key,
          reason: "b1_fix_upgrade_credits",
        },
      });
    });
    console.log(
      JSON.stringify(
        { ok: true, organizationId: org.id, granted: need, balanceAfter, monthly },
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
