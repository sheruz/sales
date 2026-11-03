/**
 * PoW5 smoke: catalog, modules, AUDIT_DEEP → proof_of_work, plan seed matrix.
 *
 *   node scripts/run-with-env.js npx tsx scripts/pow5-verify.js
 */
/* eslint-disable @typescript-eslint/no-require-imports */
require("./load-env");

function ok(name, detail) {
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name, detail) {
  console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  process.exitCode = 1;
}

async function importMod(specifier) {
  const mod = await import(specifier);
  if (mod && typeof mod.default && typeof mod.default === "object") {
    return { ...mod.default, ...mod };
  }
  return mod;
}

async function main() {
  const catalog = require("./b1-plan-catalog");
  const { B1_PLAN_CATALOG } = catalog;

  const byCode = Object.fromEntries(
    B1_PLAN_CATALOG.filter((p) => p.code).map((p) => [p.code, p])
  );

  for (const code of ["STARTER", "GROWTH"]) {
    const feat = byCode[code]?.features?.proof_of_work;
    if (!feat || feat.enabled !== false) {
      fail(`catalog-${code}`, `expected proof_of_work off, got ${JSON.stringify(feat)}`);
    } else {
      ok(`catalog-${code}`, "proof_of_work off");
    }
  }
  for (const code of ["PRO", "AGENCY"]) {
    const feat = byCode[code]?.features?.proof_of_work;
    if (!feat || feat.enabled !== true) {
      fail(`catalog-${code}`, `expected proof_of_work on, got ${JSON.stringify(feat)}`);
    } else {
      ok(`catalog-${code}`, "proof_of_work on");
    }
  }

  const { MODULE_KEYS, MODULE_CATALOG, getModuleDef } = await importMod(
    "../src/lib/billing/modules.ts"
  );
  if (MODULE_KEYS.PROOF_OF_WORK !== "proof_of_work") {
    fail("module-key", MODULE_KEYS.PROOF_OF_WORK);
  } else {
    ok("module-key", "proof_of_work");
  }
  const def =
    getModuleDef?.(MODULE_KEYS.PROOF_OF_WORK) ||
    MODULE_CATALOG.find((m) => m.key === MODULE_KEYS.PROOF_OF_WORK);
  if (!def || def.availableOn !== "Pro") {
    fail("module-catalog", JSON.stringify(def));
  } else {
    ok("module-catalog", `availableOn=${def.availableOn}`);
  }
  const apis = def?.apiPrefixes || [];
  if (!apis.includes("/api/pow") || !apis.includes("/api/autopilot/audit/deep")) {
    fail("module-apis", apis.join(","));
  } else {
    ok("module-apis", apis.join(", "));
  }

  const { FEATURE_KEYS } = await importMod("../src/lib/billing/features.ts");
  const { BILLING_ACTIONS, getActionDef } = await importMod(
    "../src/lib/billing/actions.ts"
  );
  const deep = getActionDef(BILLING_ACTIONS.AUDIT_DEEP);
  if (!deep || deep.featureKey !== FEATURE_KEYS.PROOF_OF_WORK) {
    fail("audit-deep-feature", JSON.stringify(deep));
  } else {
    ok("audit-deep-feature", "AUDIT_DEEP → proof_of_work");
  }
  if (!deep || deep.metric !== "AUDIT_DEEP") {
    fail("audit-deep-metric", deep?.metric);
  } else {
    ok("audit-deep-metric", "AUDIT_DEEP");
  }
  const preview = getActionDef(BILLING_ACTIONS.PREVIEW_PAGE);
  if (!preview || preview.creditActionType !== "preview_page") {
    fail("preview-page-action", JSON.stringify(preview));
  } else {
    ok("preview-page-action", `metric=${preview.metric}`);
  }

  // DB seed matrix (skip gracefully if DB unreachable)
  try {
    const { PrismaClient } = require("@prisma/client");
    const prisma = new PrismaClient();
    try {
      const plans = await prisma.plan.findMany({
        where: {
          code: { in: ["STARTER", "GROWTH", "PRO", "AGENCY"] },
          archivedAt: null,
        },
        select: {
          id: true,
          code: true,
          currentVersionId: true,
          versions: { select: { id: true } },
          features: {
            where: { featureKey: "proof_of_work" },
            select: { enabled: true, limitValue: true },
          },
        },
      });
      if (plans.length === 0) {
        ok("db-seed", "no plans in DB (skipped)");
      } else {
        for (const plan of plans) {
          const want = plan.code === "PRO" || plan.code === "AGENCY";
          let feat = null;
          if (plan.currentVersionId) {
            feat = await prisma.planVersionFeature.findUnique({
              where: {
                planVersionId_featureKey: {
                  planVersionId: plan.currentVersionId,
                  featureKey: "proof_of_work",
                },
              },
              select: { enabled: true },
            });
          }
          if (!feat && plan.versions.length) {
            feat = await prisma.planVersionFeature.findFirst({
              where: {
                featureKey: "proof_of_work",
                planVersionId: { in: plan.versions.map((v) => v.id) },
              },
              select: { enabled: true },
            });
          }
          // Legacy PlanFeature fallback when no plan_versions (local/dev drift)
          if (!feat) feat = plan.features?.[0] || null;

          if (!feat) {
            fail(
              `db-${plan.code}`,
              "proof_of_work missing — run: npm run db:seed:pow5"
            );
          } else if (Boolean(feat.enabled) !== want) {
            fail(`db-${plan.code}`, `enabled=${feat.enabled} want=${want}`);
          } else {
            ok(
              `db-${plan.code}`,
              `enabled=${feat.enabled}${plan.currentVersionId ? "" : " (legacy plan_features)"}`
            );
          }
        }
      }
    } finally {
      await prisma.$disconnect();
    }
  } catch (e) {
    ok("db-seed", `skipped (${e instanceof Error ? e.message : String(e)})`);
  }

  if (process.exitCode) {
    console.error("\nPoW5 verify FAILED");
  } else {
    console.log("\nPoW5 verify OK");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
