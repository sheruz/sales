/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * B1 APPLY — schema + seed Starter/Growth/Pro/Agency (+ internal) + migrate orgs.
 * Refuses unless APPLY=1. Run dry-run first and wait for operator GO.
 *
 *   node scripts/b1-dry-run.js
 *   APPLY=1 node scripts/b1-apply.js
 */
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const {
  OWNER_ORG_NAME,
  TEST_TENANT_NAME,
  B1_PLAN_CATALOG,
  featuresToRows,
  createPrisma,
  isApply,
  tableExists,
  inspectB1Schema,
  isPlatformOwnerOrg,
  isLegacyPlan,
  proposeOrgMigration,
} = require("./b1-lib");

async function applySchemaSql(prisma) {
  const sqlPath = path.join(__dirname, "b1-schema.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");
  try {
    await prisma.$executeRawUnsafe(sql);
  } catch (e) {
    // Prisma/pg may reject multi-statement batches — split on semicolons outside DO blocks
    console.warn(
      "b1-schema.sql single-batch failed, splitting statements:",
      e.message
    );
    await runSqlStatements(prisma, sql);
  }
}

async function runSqlStatements(prisma, sql) {
  // Split carefully: keep DO $$ ... $$; blocks intact
  const parts = [];
  let buf = "";
  let inDo = false;
  const lines = sql.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("--")) continue;
    if (/^DO\s+\$\$/i.test(trimmed)) inDo = true;
    buf += line + "\n";
    if (inDo) {
      if (/\$\$\s*;\s*$/.test(trimmed)) {
        parts.push(buf.trim());
        buf = "";
        inDo = false;
      }
      continue;
    }
    if (trimmed.endsWith(";")) {
      parts.push(buf.trim());
      buf = "";
    }
  }
  if (buf.trim()) parts.push(buf.trim());

  for (const stmt of parts) {
    if (!stmt || stmt === ";") continue;
    try {
      await prisma.$executeRawUnsafe(stmt);
    } catch (err) {
      console.warn("SQL stmt warning:", err.message);
    }
  }
}

async function seedCatalog(prisma) {
  const seeded = [];
  for (const def of B1_PLAN_CATALOG) {
    let plan = await prisma.plan.findFirst({ where: { code: def.code } });
    const planData = {
      name: def.name,
      code: def.code,
      description: def.description,
      price: def.priceMonthly,
      currency: "USD",
      billingInterval: "MONTHLY",
      active: true,
      sortOrder: def.sortOrder,
      isDefault: def.isDefault,
      visibility: def.visibility,
      monthlyCredits: def.monthlyCredits,
      creditRolloverEnabled: def.creditRolloverEnabled,
      creditRolloverCap: def.creditRolloverCapMonths,
      mostPopular: def.mostPopular,
      archivedAt: null,
    };

    if (!plan) {
      plan = await prisma.plan.create({
        data: { id: randomUUID(), ...planData },
      });
    } else {
      plan = await prisma.plan.update({
        where: { id: plan.id },
        data: planData,
      });
    }

    let version = await prisma.planVersion.findFirst({
      where: { planId: plan.id, version: 1 },
    });
    if (!version) {
      version = await prisma.planVersion.create({
        data: {
          id: randomUUID(),
          planId: plan.id,
          version: 1,
          priceMonthly: def.priceMonthly,
          priceYearly: def.priceYearly,
          currency: "USD",
          monthlyCredits: def.monthlyCredits,
          creditRolloverEnabled: def.creditRolloverEnabled,
          creditRolloverCapMonths: def.creditRolloverCapMonths,
          notes: "B1 seed v1",
        },
      });
    } else {
      version = await prisma.planVersion.update({
        where: { id: version.id },
        data: {
          priceMonthly: def.priceMonthly,
          priceYearly: def.priceYearly,
          monthlyCredits: def.monthlyCredits,
          creditRolloverEnabled: def.creditRolloverEnabled,
          creditRolloverCapMonths: def.creditRolloverCapMonths,
        },
      });
    }

    const rows = featuresToRows(def.features);
    let featuresUpserted = 0;
    for (const row of rows) {
      await prisma.planVersionFeature.upsert({
        where: {
          planVersionId_featureKey: {
            planVersionId: version.id,
            featureKey: row.featureKey,
          },
        },
        create: {
          id: randomUUID(),
          planVersionId: version.id,
          featureKey: row.featureKey,
          limitValue: row.limitValue,
          enabled: row.enabled,
        },
        update: {
          limitValue: row.limitValue,
          enabled: row.enabled,
        },
      });
      featuresUpserted++;
    }

    await prisma.plan.update({
      where: { id: plan.id },
      data: { currentVersionId: version.id },
    });

    seeded.push({
      code: def.code,
      planId: plan.id,
      versionId: version.id,
      featuresUpserted,
    });
  }
  return seeded;
}

async function archiveLegacyPlans(prisma) {
  const plans = await prisma.plan.findMany();
  const archived = [];
  const now = new Date();
  for (const plan of plans) {
    if (!isLegacyPlan(plan)) continue;
    if (plan.archivedAt && plan.active === false) {
      archived.push({
        id: plan.id,
        name: plan.name,
        code: plan.code,
        skipped: true,
      });
      continue;
    }
    await prisma.plan.update({
      where: { id: plan.id },
      data: {
        active: false,
        archivedAt: plan.archivedAt ?? now,
        visibility: "INTERNAL",
        isDefault: false,
        mostPopular: false,
      },
    });
    archived.push({
      id: plan.id,
      name: plan.name,
      code: plan.code,
      skipped: false,
    });
  }
  return archived;
}

async function migrateOrganizations(prisma, platformOwnerId) {
  const starter = await prisma.plan.findFirst({
    where: { code: "STARTER" },
  });
  const starterVersion =
    starter &&
    (await prisma.planVersion.findFirst({
      where: { planId: starter.id, version: 1 },
    }));
  const ownerPlan = await prisma.plan.findFirst({
    where: { OR: [{ code: "OWNER" }, { name: "OWNER" }] },
  });
  const ownerVersion =
    ownerPlan &&
    (await prisma.planVersion.findFirst({
      where: { planId: ownerPlan.id, version: 1 },
      orderBy: { version: "asc" },
    }));

  const orgs = await prisma.organization.findMany({
    include: {
      subscriptions: {
        include: { plan: true },
        take: 1,
      },
    },
  });

  const results = [];
  for (const org of orgs) {
    const sub = org.subscriptions?.[0] ?? null;
    const owner = isPlatformOwnerOrg(org, platformOwnerId);

    if (owner) {
      // Ensure Delvix/owner keeps OWNER if assigned (or assign OWNER when missing)
      let ensuredOwner = false;
      if (ownerPlan && ownerVersion) {
        const onOwner =
          sub &&
          (sub.plan?.code === "OWNER" ||
            sub.plan?.name === "OWNER" ||
            sub.planId === ownerPlan.id);
        if (!sub) {
          await prisma.subscription.create({
            data: {
              id: randomUUID(),
              organizationId: org.id,
              planId: ownerPlan.id,
              planVersionId: ownerVersion.id,
              provider: "internal",
              accessMode: "complimentary",
              status: "ACTIVE",
            },
          });
          ensuredOwner = true;
        } else if (!onOwner) {
          // Already on something else — leave; only ensure if already OWNER or no plan code
          if (
            !sub.plan?.code ||
            sub.plan.code === "OWNER" ||
            sub.plan.name === "OWNER"
          ) {
            await prisma.subscription.update({
              where: { id: sub.id },
              data: {
                planId: ownerPlan.id,
                planVersionId: ownerVersion.id,
                status: "ACTIVE",
                accessMode: sub.accessMode || "complimentary",
              },
            });
            ensuredOwner = true;
          }
        } else if (onOwner && !sub.planVersionId) {
          await prisma.subscription.update({
            where: { id: sub.id },
            data: { planVersionId: ownerVersion.id },
          });
          ensuredOwner = true;
        }
      }
      results.push({
        name: org.name,
        platformOwner: true,
        action: "untouched",
        ensuredOwner,
      });
      continue;
    }

    const proposal = proposeOrgMigration(org, sub);
    const updates = { org: null, sub: null };

    if (proposal.proposed.orgStatus !== org.status) {
      await prisma.organization.update({
        where: { id: org.id },
        data: { status: proposal.proposed.orgStatus },
      });
      updates.org = proposal.proposed.orgStatus;
    }

    const isTestTenant = org.name === TEST_TENANT_NAME;

    if (isTestTenant) {
      if (!starter || !starterVersion) {
        throw new Error("STARTER plan/version missing after seed");
      }
      const now = new Date();
      const periodEnd = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
      );
      if (sub) {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: {
            planId: starter.id,
            planVersionId: starterVersion.id,
            status: "ACTIVE",
            accessMode: "manual",
            provider: sub.provider || "internal",
            currentPeriodStart: sub.currentPeriodStart ?? now,
            currentPeriodEnd: sub.currentPeriodEnd ?? periodEnd,
            pendingPlanVersionId: null,
            pendingApplyAt: null,
          },
        });
      } else {
        await prisma.subscription.create({
          data: {
            id: randomUUID(),
            organizationId: org.id,
            planId: starter.id,
            planVersionId: starterVersion.id,
            status: "ACTIVE",
            accessMode: "manual",
            provider: "internal",
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
          },
        });
      }
      if (org.status !== "ACTIVE" && org.status !== "ARCHIVED") {
        await prisma.organization.update({
          where: { id: org.id },
          data: { status: "ACTIVE" },
        });
        updates.org = "ACTIVE";
      }
      updates.sub = "STARTER v1 ACTIVE";
    } else if (
      proposal.proposed.subStatus &&
      sub &&
      proposal.proposed.subStatus !== sub.status
    ) {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: proposal.proposed.subStatus },
      });
      updates.sub = proposal.proposed.subStatus;
    }

    results.push({
      name: org.name,
      platformOwner: false,
      actions: proposal.actions,
      updates,
    });
  }
  return results;
}

async function main() {
  if (!isApply()) {
    console.error(
      JSON.stringify(
        {
          error:
            "Refusing apply. Re-run dry-run, then APPLY=1 node scripts/b1-apply.js after GO.",
          dryRun: "node scripts/b1-dry-run.js",
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  const prisma = createPrisma();
  const platformOwnerId = process.env.PLATFORM_OWNER_ORG_ID || null;

  try {
    console.log("Applying B1 additive SQL (b1-schema.sql)…");
    await applySchemaSql(prisma);

    const schema = await inspectB1Schema(prisma);
    const hasVersions = await tableExists(prisma, "plan_versions");
    const hasFeatures = await tableExists(prisma, "plan_version_features");
    if (!hasVersions || !hasFeatures || !schema.ready) {
      throw new Error(
        `B1 schema incomplete after apply: ${JSON.stringify(schema)}`
      );
    }

    const seeded = await seedCatalog(prisma);
    const archived = await archiveLegacyPlans(prisma);
    const migrations = await migrateOrganizations(prisma, platformOwnerId);

    console.log(
      JSON.stringify(
        {
          phase: "B1",
          mode: "APPLY",
          ok: true,
          schemaReady: schema.ready,
          seeded,
          archivedLegacy: archived,
          migrations,
          testTenantName: TEST_TENANT_NAME,
          ownerOrgName: OWNER_ORG_NAME,
          next: [
            "npm run build",
            "pm2 restart sales",
            "Verify then remove legacy PlanFeature fallbacks (docs/b1-legacy-planfeature.md)",
          ],
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
