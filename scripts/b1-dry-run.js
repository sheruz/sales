/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * B1 dry-run (READ-ONLY). Schema presence + per-org proposed migration.
 * Does NOT apply. Wait for GO before: APPLY=1 node scripts/b1-apply.js
 */
const {
  OWNER_ORG_NAME,
  TEST_TENANT_NAME,
  B1_PLAN_CATALOG,
  LEGACY_PLAN_NAMES,
  CATALOG_CODES,
  readOnlyPrisma,
  inspectB1Schema,
  isPlatformOwnerOrg,
  isLegacyPlan,
  proposeOrgMigration,
} = require("./b1-lib");

async function main() {
  const prisma = readOnlyPrisma();
  const platformOwnerId = process.env.PLATFORM_OWNER_ORG_ID || null;

  const out = {
    phase: "B1",
    mode: "DRY_RUN",
    at: new Date().toISOString(),
    platformOwnerOrgId: platformOwnerId,
    ownerOrgName: OWNER_ORG_NAME,
    testTenantName: TEST_TENANT_NAME,
    schema: null,
    catalogCodes: CATALOG_CODES,
    legacyPlansToArchive: [],
    plansToSeed: [],
    organizations: [],
    notes: [],
    fatal: [],
  };

  try {
    out.schema = await inspectB1Schema(prisma);

    const planSelect = {
      id: true,
      name: true,
      code: true,
      active: true,
      visibility: true,
      price: true,
    };
    if (out.schema.columns["plans.archived_at"]) planSelect.archivedAt = true;
    if (out.schema.columns["plans.current_version_id"]) {
      planSelect.currentVersionId = true;
    }
    if (out.schema.columns["plans.most_popular"]) planSelect.mostPopular = true;

    const plans = await prisma.plan.findMany({
      select: planSelect,
      orderBy: { sortOrder: "asc" },
    });

    for (const plan of plans) {
      if (isLegacyPlan(plan)) {
        out.legacyPlansToArchive.push({
          id: plan.id,
          name: plan.name,
          code: plan.code,
          active: plan.active,
          visibility: plan.visibility,
          archivedAt: plan.archivedAt ?? null,
          action:
            plan.archivedAt && plan.active === false
              ? "already archived"
              : "set active=false, archivedAt=now, visibility=INTERNAL",
        });
      }
    }

    for (const def of B1_PLAN_CATALOG) {
      const existing = plans.find((p) => p.code === def.code);
      out.plansToSeed.push({
        code: def.code,
        name: def.name,
        priceMonthly: def.priceMonthly,
        priceYearly: def.priceYearly,
        monthlyCredits: def.monthlyCredits,
        mostPopular: def.mostPopular,
        visibility: def.visibility,
        exists: Boolean(existing),
        existingId: existing?.id ?? null,
        action: existing
          ? "upsert plan + ensure version 1 features; set currentVersionId"
          : "create plan + version 1 + features",
      });
    }

    // Legacy Growth named plan with no catalog code still listed under archive
    const missingLegacy = LEGACY_PLAN_NAMES.filter(
      (n) =>
        !out.legacyPlansToArchive.some((p) => p.name === n) &&
        !plans.some((p) => p.code && CATALOG_CODES.includes(p.code) && p.name === n)
    );
    if (missingLegacy.length) {
      out.notes.push(
        `No legacy rows for: ${missingLegacy.join(", ")} (ok if never seeded).`
      );
    }

    const subSelect = {
      id: true,
      status: true,
      plan: { select: { id: true, code: true, name: true } },
    };
    if (out.schema.columns["subscriptions.plan_version_id"]) {
      subSelect.planVersionId = true;
    }

    const orgs = await prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        deletedAt: true,
        subscriptions: {
          select: subSelect,
          take: 1,
        },
      },
      orderBy: { name: "asc" },
    });

    for (const org of orgs) {
      const sub = org.subscriptions?.[0] ?? null;
      const owner = isPlatformOwnerOrg(org, platformOwnerId);

      if (owner) {
        out.organizations.push({
          organizationId: org.id,
          name: org.name,
          platformOwner: true,
          current: {
            orgStatus: org.status,
            subStatus: sub?.status ?? null,
            planCode: sub?.plan?.code ?? null,
            planName: sub?.plan?.name ?? null,
            planVersionId: sub?.planVersionId ?? null,
          },
          proposed: {
            orgStatus: org.status,
            subStatus: sub?.status ?? null,
            note: "PLATFORM_OWNER_ORG_ID / owner org — untouched",
          },
          actions: ["skip (platform owner)"],
        });
        continue;
      }

      const base = proposeOrgMigration(org, sub);
      const isTestTenant = org.name === TEST_TENANT_NAME;

      if (isTestTenant) {
        base.proposed.planCode = "STARTER";
        base.proposed.planVersion = 1;
        base.proposed.subStatus = "ACTIVE";
        base.proposed.accessMode = "manual";
        base.actions.push("Test Tenant → Starter v1 ACTIVE");
      }

      // Ensure Delvix/owner keeps OWNER if somehow not marked platform — handled above.
      // Non-owner on OWNER plan: leave as-is in dry-run (apply will not strip OWNER from platform).
      if (
        (sub?.plan?.code === "OWNER" || sub?.plan?.name === "OWNER") &&
        !owner
      ) {
        base.notes = [
          "WARNING: non-owner org on OWNER plan — apply will not reassign unless Test Tenant",
        ];
      }

      out.organizations.push(base);
    }

    if (!platformOwnerId) {
      out.notes.push(
        "PLATFORM_OWNER_ORG_ID unset — matching owner by OWNER_ORG_NAME only."
      );
    }

    const ownerRow = out.organizations.find((o) => o.platformOwner);
    if (!ownerRow) {
      out.fatal.push(
        `Platform owner org not found (PLATFORM_OWNER_ORG_ID / "${OWNER_ORG_NAME}")`
      );
    } else {
      out.notes.push(
        `OK: platform owner "${ownerRow.name}" listed as untouched.`
      );
    }

    const testRow = out.organizations.find(
      (o) => o.name === TEST_TENANT_NAME && !o.platformOwner
    );
    if (testRow) {
      out.notes.push(
        `OK: "${TEST_TENANT_NAME}" proposed → Starter v1 ACTIVE.`
      );
    } else {
      out.notes.push(
        `WARNING: "${TEST_TENANT_NAME}" not found — create before apply if required.`
      );
    }

    out.notes.push(
      "After review: APPLY=1 node scripts/b1-apply.js then build + pm2 restart sales"
    );
    out.notes.push("Do not start Stripe / B2 in this phase.");

    console.log(JSON.stringify(out, null, 2));
    if (out.fatal.length) process.exitCode = 1;
  } catch (err) {
    console.error(
      JSON.stringify(
        {
          phase: "B1",
          mode: "DRY_RUN",
          error: err instanceof Error ? err.message : String(err),
        },
        null,
        2
      )
    );
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
