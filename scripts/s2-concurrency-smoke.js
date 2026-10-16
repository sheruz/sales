/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Parallel reserve smoke (requires DB + S2 schema + Test Tenant).
 * Reserves 1 credit N times in parallel; enforced org must never go negative.
 *
 *   node scripts/s2-concurrency-smoke.js
 */
const { randomUUID } = require("crypto");
const {
  createPrisma,
  TEST_TENANT_NAME,
} = require("./s2-lib");

async function reserveOnce(prisma, orgId, key, n) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.creditLedgerEntry.findUnique({
      where: { idempotencyKey: key },
    });
    if (existing) return { ok: true, duplicate: true, balanceAfter: existing.balanceAfter };

    const rows = await tx.$queryRaw`
      SELECT id, credit_balance_cached, billing_enforcement_enabled
      FROM organizations WHERE id = ${orgId} FOR UPDATE
    `;
    const org = rows[0];
    if (!org) throw new Error("org missing");
    if (
      org.billing_enforcement_enabled &&
      org.credit_balance_cached < n
    ) {
      return { ok: false, reason: "insufficient", balance: org.credit_balance_cached };
    }
    const balanceAfter = org.credit_balance_cached - n;
    await tx.organization.update({
      where: { id: orgId },
      data: { creditBalanceCached: balanceAfter },
    });
    await tx.creditLedgerEntry.create({
      data: {
        id: randomUUID(),
        organizationId: orgId,
        type: "RESERVE",
        amount: -n,
        balanceAfter,
        actionType: "concurrency_smoke",
        idempotencyKey: key,
        reserveIdempotencyKey: key,
        reason: "s2_concurrency_smoke",
      },
    });
    return { ok: true, balanceAfter };
  });
}

async function main() {
  const prisma = createPrisma();
  try {
    const org = await prisma.organization.findFirst({
      where: { name: TEST_TENANT_NAME, deletedAt: null },
    });
    if (!org) {
      console.log(
        JSON.stringify({
          ok: false,
          skip: true,
          reason: "Test Tenant missing — run S2 APPLY first",
        })
      );
      return;
    }

    const before = org.creditBalanceCached;
    const n = 1;
    const parallel = Math.min(20, Math.max(2, before + 5));
    const keys = Array.from({ length: parallel }, (_, i) =>
      `smoke:${org.id}:${Date.now()}:${i}:${randomUUID()}`
    );

    const results = await Promise.all(
      keys.map((k) => reserveOnce(prisma, org.id, k, n))
    );

    const afterOrg = await prisma.organization.findUnique({
      where: { id: org.id },
    });
    const after = afterOrg.creditBalanceCached;
    const successes = results.filter((r) => r.ok && !r.duplicate).length;
    const blocked = results.filter((r) => !r.ok).length;

    // Refund smoke reserves
    for (const k of keys) {
      const refundKey = `${k}:refund`;
      const reserve = await prisma.creditLedgerEntry.findUnique({
        where: { idempotencyKey: k },
      });
      if (!reserve) continue;
      const already = await prisma.creditLedgerEntry.findUnique({
        where: { idempotencyKey: refundKey },
      });
      if (already) continue;
      await prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw`
          SELECT id, credit_balance_cached FROM organizations
          WHERE id = ${org.id} FOR UPDATE
        `;
        const bal = rows[0].credit_balance_cached + Math.abs(reserve.amount);
        await tx.organization.update({
          where: { id: org.id },
          data: { creditBalanceCached: bal },
        });
        await tx.creditLedgerEntry.create({
          data: {
            id: randomUUID(),
            organizationId: org.id,
            type: "REFUND",
            amount: Math.abs(reserve.amount),
            balanceAfter: bal,
            idempotencyKey: refundKey,
            reserveIdempotencyKey: k,
            reason: "s2_concurrency_smoke_cleanup",
          },
        });
      });
    }

    const restored = await prisma.organization.findUnique({
      where: { id: org.id },
    });

    const neverNegative = after >= 0;
    const ok =
      neverNegative &&
      successes + blocked === parallel &&
      restored.creditBalanceCached === before;

    console.log(
      JSON.stringify(
        {
          ok,
          orgId: org.id,
          before,
          afterParallel: after,
          afterCleanup: restored.creditBalanceCached,
          parallel,
          successes,
          blocked,
          neverNegative,
          restored: restored.creditBalanceCached === before,
        },
        null,
        2
      )
    );
    if (!ok) process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
