/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * S2 ledger reconcile — sum(signed amounts) vs credit_balance_cached.
 * Understands RESERVE(-n) + COMMIT(0) = consumed; RESERVE + REFUND(+n) = net 0.
 *
 *   node scripts/s2-reconcile.js
 *   ORG_ID=uuid node scripts/s2-reconcile.js
 */
const { createPrisma } = require("./s2-lib");

async function main() {
  const prisma = createPrisma();
  const orgFilter = process.env.ORG_ID || null;
  try {
    const orgs = await prisma.organization.findMany({
      where: orgFilter
        ? { id: orgFilter }
        : { deletedAt: null },
      select: {
        id: true,
        name: true,
        creditBalanceCached: true,
        billingEnforcementEnabled: true,
      },
    });

    const mismatches = [];
    const openReserves = [];

    for (const org of orgs) {
      const sum = await prisma.creditLedgerEntry.aggregate({
        where: { organizationId: org.id },
        _sum: { amount: true },
      });
      const ledger = sum._sum.amount ?? 0;
      if (ledger !== org.creditBalanceCached) {
        mismatches.push({
          organizationId: org.id,
          name: org.name,
          cached: org.creditBalanceCached,
          ledger,
          delta: org.creditBalanceCached - ledger,
        });
      }

      const reserves = await prisma.creditLedgerEntry.findMany({
        where: { organizationId: org.id, type: "RESERVE" },
        select: { idempotencyKey: true, amount: true, createdAt: true },
      });
      for (const r of reserves) {
        const commit = await prisma.creditLedgerEntry.findUnique({
          where: { idempotencyKey: `${r.idempotencyKey}:commit` },
        });
        const refund = await prisma.creditLedgerEntry.findUnique({
          where: { idempotencyKey: `${r.idempotencyKey}:refund` },
        });
        if (!commit && !refund) {
          openReserves.push({
            organizationId: org.id,
            reserveKey: r.idempotencyKey,
            amount: r.amount,
            createdAt: r.createdAt,
          });
        }
        if (commit && refund) {
          mismatches.push({
            organizationId: org.id,
            name: org.name,
            error: "reserve_has_both_commit_and_refund",
            reserveKey: r.idempotencyKey,
          });
        }
      }
    }

    const out = {
      meta: {
        phase: "s2-reconcile",
        at: new Date().toISOString(),
        checked: orgs.length,
      },
      ok: mismatches.length === 0,
      mismatches,
      openReserves: {
        count: openReserves.length,
        sample: openReserves.slice(0, 20),
      },
      semantics:
        "Signed amounts: GRANT/REFUND +, RESERVE/CONSUME -, COMMIT 0. Cache == sum(amount).",
    };
    console.log(JSON.stringify(out, null, 2));
    if (mismatches.length) process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
