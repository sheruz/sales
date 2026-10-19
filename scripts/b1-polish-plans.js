/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * B1 polish: sync marketing descriptions + ensure dashboard module on paid plans.
 * Dry-run by default. APPLY=1 to write.
 *
 *   node scripts/b1-polish-plans.js
 *   APPLY=1 node scripts/b1-polish-plans.js
 */
require("./load-env");
const { ensureDatabaseUrl } = require("./database-url");
ensureDatabaseUrl();
const { PrismaClient } = require("@prisma/client");
const { B1_PLAN_CATALOG } = require("./b1-plan-catalog");

const APPLY = process.env.APPLY === "1";

async function main() {
  const prisma = new PrismaClient();
  const out = { mode: APPLY ? "APPLY" : "DRY_RUN", changes: [], ok: true };

  try {
    for (const def of B1_PLAN_CATALOG) {
      if (def.internal && def.code !== "OWNER" && def.code !== "COMPLIMENTARY") {
        continue;
      }
      const plan = await prisma.plan.findFirst({ where: { code: def.code } });
      if (!plan) {
        out.changes.push({ code: def.code, action: "missing plan — run b1-apply" });
        continue;
      }

      if (plan.description !== def.description) {
        out.changes.push({
          code: def.code,
          field: "description",
          from: plan.description,
          to: def.description,
        });
        if (APPLY) {
          await prisma.plan.update({
            where: { id: plan.id },
            data: {
              description: def.description,
              monthlyCredits: def.monthlyCredits,
            },
          });
        }
      } else if (APPLY && plan.monthlyCredits !== def.monthlyCredits) {
        await prisma.plan.update({
          where: { id: plan.id },
          data: { monthlyCredits: def.monthlyCredits },
        });
        out.changes.push({
          code: def.code,
          field: "monthlyCredits",
          to: def.monthlyCredits,
        });
      }

      const versionId = plan.currentVersionId;
      if (!versionId) {
        out.changes.push({ code: def.code, action: "no currentVersionId" });
        continue;
      }

      // Ensure every catalog feature exists on current version
      const features = def.features || {};
      for (const [key, meta] of Object.entries(features)) {
        const row = await prisma.planVersionFeature.findUnique({
          where: {
            planVersionId_featureKey: {
              planVersionId: versionId,
              featureKey: key,
            },
          },
        });
        const wantEnabled = Boolean(meta.enabled);
        const wantLimit =
          meta.limitValue === undefined ? null : meta.limitValue;
        if (!row) {
          out.changes.push({
            code: def.code,
            featureKey: key,
            action: "create",
            enabled: wantEnabled,
            limitValue: wantLimit,
          });
          if (APPLY) {
            await prisma.planVersionFeature.create({
              data: {
                planVersionId: versionId,
                featureKey: key,
                enabled: wantEnabled,
                limitValue: wantLimit,
              },
            });
          }
        } else if (
          row.enabled !== wantEnabled ||
          row.limitValue !== wantLimit
        ) {
          out.changes.push({
            code: def.code,
            featureKey: key,
            action: "update",
            from: { enabled: row.enabled, limitValue: row.limitValue },
            to: { enabled: wantEnabled, limitValue: wantLimit },
          });
          if (APPLY) {
            await prisma.planVersionFeature.update({
              where: { id: row.id },
              data: { enabled: wantEnabled, limitValue: wantLimit },
            });
          }
        }
      }

      // Explicit dashboard check for public plans
      if (!def.internal) {
        const dash = await prisma.planVersionFeature.findUnique({
          where: {
            planVersionId_featureKey: {
              planVersionId: versionId,
              featureKey: "dashboard",
            },
          },
        });
        if (!dash?.enabled) {
          out.changes.push({
            code: def.code,
            featureKey: "dashboard",
            action: dash ? "enable" : "missing",
            severity: "must_fix",
          });
        }
      }
    }

    console.log(JSON.stringify(out, null, 2));
    if (out.changes.some((c) => c.severity === "must_fix") && !APPLY) {
      process.exitCode = 2;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e.message }));
  process.exitCode = 1;
});
