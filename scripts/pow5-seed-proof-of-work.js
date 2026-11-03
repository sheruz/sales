/**
 * PoW5 — upsert proof_of_work on every plan version (by plan code).
 * Run BEFORE relying on AUDIT_DEEP → PROOF_OF_WORK gate under enforcement.
 *
 *   DRY_RUN=1 node scripts/run-with-env.js node scripts/pow5-seed-proof-of-work.js
 *   node scripts/run-with-env.js node scripts/pow5-seed-proof-of-work.js
 */
/* eslint-disable @typescript-eslint/no-require-imports */
require("./load-env");
const { randomUUID } = require("crypto");
const { PrismaClient } = require("@prisma/client");

const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

/** Enabled on Pro+ (and internal owner/complimentary). Off on Starter/Growth/Unassigned. */
const ENABLED_CODES = new Set([
  "PRO",
  "AGENCY",
  "OWNER",
  "COMPLIMENTARY",
]);

async function main() {
  const prisma = new PrismaClient();
  console.log(`PoW5 seed proof_of_work${DRY_RUN ? " (DRY_RUN)" : ""}`);
  try {
    const plans = await prisma.plan.findMany({
      where: { archivedAt: null },
      select: {
        id: true,
        code: true,
        name: true,
        versions: { select: { id: true, version: true } },
      },
    });

    let upserts = 0;
    for (const plan of plans) {
      const code = String(plan.code || "").toUpperCase();
      const enabled = ENABLED_CODES.has(code);
      for (const ver of plan.versions) {
        const existing = await prisma.planVersionFeature.findUnique({
          where: {
            planVersionId_featureKey: {
              planVersionId: ver.id,
              featureKey: "proof_of_work",
            },
          },
        });
        const next = {
          enabled,
          limitValue: enabled ? null : 0,
        };
        if (
          existing &&
          existing.enabled === next.enabled &&
          existing.limitValue === next.limitValue
        ) {
          continue;
        }
        console.log(
          `  ${plan.code} v${ver.version}: ${existing ? "update" : "create"} enabled=${enabled}`
        );
        if (!DRY_RUN) {
          if (existing) {
            await prisma.planVersionFeature.update({
              where: { id: existing.id },
              data: next,
            });
          } else {
            await prisma.planVersionFeature.create({
              data: {
                id: randomUUID(),
                planVersionId: ver.id,
                featureKey: "proof_of_work",
                ...next,
              },
            });
          }
        }
        upserts += 1;
      }

      // Also mirror on legacy PlanFeature for transition fallbacks
      const legacy = await prisma.planFeature.findUnique({
        where: {
          planId_featureKey: {
            planId: plan.id,
            featureKey: "proof_of_work",
          },
        },
      });
      if (
        !legacy ||
        legacy.enabled !== enabled ||
        legacy.limitValue !== (enabled ? null : 0)
      ) {
        console.log(
          `  ${plan.code} plan_features: ${legacy ? "update" : "create"} enabled=${enabled}`
        );
        if (!DRY_RUN) {
          if (legacy) {
            await prisma.planFeature.update({
              where: { id: legacy.id },
              data: { enabled, limitValue: enabled ? null : 0 },
            });
          } else {
            await prisma.planFeature.create({
              data: {
                id: randomUUID(),
                planId: plan.id,
                featureKey: "proof_of_work",
                enabled,
                limitValue: enabled ? null : 0,
              },
            });
          }
        }
        upserts += 1;
      }
    }
    console.log(`Done. ${upserts} change(s)${DRY_RUN ? " (dry)" : ""}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
