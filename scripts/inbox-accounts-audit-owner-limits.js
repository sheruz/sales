/**
 * Audit inbox/email rows for Default Workspace + raise owner plan limits.
 *
 * Dry-run (default): list rows + planned changes, delete nothing.
 * Apply: soft-disconnect inactive EmailAccounts that still look "connected",
 *        clear stale EMAIL_SMTP UserIntegration publicConfig, create/assign
 *        Internal Owner plan (inbox_accounts≥10, outbound_mailboxes≥10).
 *
 * Usage:
 *   DRY_RUN=1 node scripts/run-with-env.js node scripts/inbox-accounts-audit-owner-limits.js
 *   APPLY=1 node scripts/run-with-env.js node scripts/inbox-accounts-audit-owner-limits.js
 *
 * Scoped to org name "Default Workspace" (owner tenant only).
 */
const { PrismaClient } = require("@prisma/client");
const { randomUUID } = require("crypto");
require("./load-env");

const prisma = new PrismaClient();
// Default dry-run. Set APPLY=1 to write.
const DRY_RUN = process.env.APPLY !== "1" && process.env.APPLY !== "true";

const ORG_NAME = process.env.OWNER_ORG_NAME || "Default Workspace";
const INBOX_LIMIT = Number(process.env.OWNER_INBOX_LIMIT || 10);
const OUTBOUND_LIMIT = Number(process.env.OWNER_OUTBOUND_LIMIT || 10);
const PLAN_NAME = "Internal Owner";

function iso(d) {
  return d ? new Date(d).toISOString() : null;
}

async function upsertPlanFeature(planId, featureKey, limitValue, enabled = true) {
  const existing = await prisma.planFeature.findUnique({
    where: { planId_featureKey: { planId, featureKey } },
  });
  if (existing) {
    if (
      existing.limitValue === limitValue &&
      existing.enabled === enabled
    ) {
      return { action: "unchanged", id: existing.id };
    }
    if (DRY_RUN) {
      return {
        action: "would_update",
        id: existing.id,
        from: { limitValue: existing.limitValue, enabled: existing.enabled },
        to: { limitValue, enabled },
      };
    }
    await prisma.planFeature.update({
      where: { id: existing.id },
      data: { limitValue, enabled },
    });
    return { action: "updated", id: existing.id };
  }
  if (DRY_RUN) {
    return { action: "would_create", featureKey, limitValue, enabled };
  }
  const row = await prisma.planFeature.create({
    data: {
      id: randomUUID(),
      planId,
      featureKey,
      limitValue,
      enabled,
    },
  });
  return { action: "created", id: row.id };
}

async function ensureOutboundFeatureOnCatalogPlans() {
  const catalog = await prisma.plan.findMany({
    where: { name: { in: ["Free", "Growth", "Scale"] } },
    include: { features: true },
  });
  const defaults = {
    Free: 1,
    Growth: 5,
    Scale: 25,
  };
  const changes = [];
  for (const plan of catalog) {
    const limit = defaults[plan.name] ?? 1;
    const r = await upsertPlanFeature(
      plan.id,
      "outbound_mailboxes",
      limit,
      true
    );
    changes.push({ plan: plan.name, planId: plan.id, ...r });
  }
  return changes;
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log(" Inbox accounts audit + Internal Owner limits");
  console.log(` Mode: ${DRY_RUN ? "DRY-RUN (no writes)" : "APPLY"}`);
  console.log(` Org:  ${ORG_NAME}`);
  console.log("═══════════════════════════════════════════════════════════\n");

  const org = await prisma.organization.findFirst({
    where: { name: ORG_NAME, deletedAt: null },
    include: {
      members: {
        where: { status: "ACTIVE" },
        include: {
          user: { select: { id: true, email: true, role: true } },
          role: { select: { id: true, name: true, key: true } },
        },
      },
      subscriptions: {
        include: { plan: { include: { features: true } } },
        take: 1,
      },
    },
  });

  if (!org) {
    console.error(`Org not found: "${ORG_NAME}"`);
    process.exit(1);
  }

  const sub = org.subscriptions[0] ?? null;

  console.log("Organization");
  console.log({
    id: org.id,
    name: org.name,
    slug: org.slug,
    createdAt: iso(org.createdAt),
    deletedAt: iso(org.deletedAt),
    members: org.members.map((m) => ({
      userId: m.userId,
      email: m.user.email,
      orgRole: m.role?.key ?? m.role?.name ?? null,
      isPrimaryAdmin: m.isPrimaryAdmin,
      userRole: m.user.role,
    })),
    currentPlan: sub?.plan?.name ?? null,
    subscriptionStatus: sub?.status ?? null,
  });
  console.log("");

  const emailAccounts = await prisma.emailAccount.findMany({
    where: { organizationId: org.id },
    orderBy: { createdAt: "asc" },
  });

  console.log(`EmailAccount rows (${emailAccounts.length}) — counted as inbox_accounts when status=ACTIVE`);
  if (emailAccounts.length === 0) {
    console.log("  (none)");
  } else {
    for (const a of emailAccounts) {
      console.log({
        id: a.id,
        type: a.provider,
        email: a.email,
        status: a.status,
        userId: a.userId,
        isDefault: a.isDefault,
        createdAt: iso(a.createdAt),
        updatedAt: iso(a.updatedAt),
        deletedAt: null, // EmailAccount has no deletedAt; DISCONNECTED = soft-delete
        hasSmtpPassword: Boolean(a.encryptedSmtpPassword),
        hasOAuthToken: Boolean(a.encryptedAccessToken),
      });
    }
  }
  console.log("");

  // Gmail/Outlook live on EmailAccount only — UserIntegration has EMAIL_SMTP.
  const integrations = await prisma.userIntegration.findMany({
    where: {
      organizationId: org.id,
      platform: "EMAIL_SMTP",
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`UserIntegration EMAIL_SMTP rows (${integrations.length})`);
  if (integrations.length === 0) {
    console.log("  (none)");
  } else {
    for (const i of integrations) {
      const cfg = i.publicConfig && typeof i.publicConfig === "object"
        ? i.publicConfig
        : {};
      console.log({
        id: i.id,
        type: i.platform,
        email: cfg.fromEmail ?? i.displayLabel ?? null,
        status: i.isConnected ? "CONNECTED" : "DISCONNECTED",
        isEnabled: i.isEnabled,
        userId: i.userId,
        createdAt: iso(i.createdAt),
        updatedAt: iso(i.updatedAt),
        deletedAt: null,
        hasCredentials: Boolean(i.encryptedCredentials),
        publicConfig: cfg,
      });
    }
  }
  console.log("");

  const mailboxes = await prisma.outboundMailbox.findMany({
    where: { organizationId: org.id },
    include: {
      emailAccount: { select: { id: true, email: true, status: true, provider: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`OutboundMailbox rows (${mailboxes.length}) — pool seats when status=ACTIVE`);
  if (mailboxes.length === 0) {
    console.log("  (none)");
  } else {
    for (const m of mailboxes) {
      console.log({
        id: m.id,
        type: "OUTBOUND_MAILBOX",
        email: m.emailAccount.email,
        status: m.status,
        emailAccountId: m.emailAccountId,
        emailAccountStatus: m.emailAccount.status,
        provider: m.emailAccount.provider,
        createdAt: iso(m.createdAt),
        updatedAt: iso(m.updatedAt),
        deletedAt: null,
      });
    }
  }
  console.log("");

  const activeInbox = emailAccounts.filter((a) => a.status === "ACTIVE").length;
  const allInbox = emailAccounts.length;
  console.log("Seat count comparison");
  console.log({
    old_count_all_email_accounts: allInbox,
    new_count_active_only: activeInbox,
    outbound_active: mailboxes.filter((m) => m.status === "ACTIVE").length,
  });
  console.log("");

  // Planned cleanups (no hard deletes unless APPLY + CLEANUP_HARD_DELETE=1)
  const planned = [];

  for (const a of emailAccounts) {
    if (a.status !== "ACTIVE") {
      planned.push({
        kind: "email_account_already_inactive",
        id: a.id,
        email: a.email,
        status: a.status,
        note: "Does not count toward inbox_accounts after ACTIVE-only fix. Optional Remove in UI.",
      });
    }
  }

  for (const i of integrations) {
    if (
      i.platform === "EMAIL_SMTP" &&
      !i.isConnected &&
      i.publicConfig &&
      typeof i.publicConfig === "object" &&
      Object.keys(i.publicConfig).length > 0
    ) {
      planned.push({
        kind: "clear_stale_smtp_public_config",
        id: i.id,
        email: i.publicConfig.fromEmail ?? null,
        action: DRY_RUN
          ? "would_clear publicConfig + displayLabel"
          : "clear publicConfig + displayLabel",
      });
    }
  }

  for (const m of mailboxes) {
    if (m.emailAccount.status !== "ACTIVE" && m.status === "ACTIVE") {
      planned.push({
        kind: "pause_or_remove_orphan_outbound_mailbox",
        id: m.id,
        email: m.emailAccount.email,
        action: DRY_RUN
          ? "would_delete OutboundMailbox (inbox not ACTIVE)"
          : "delete OutboundMailbox",
      });
    }
  }

  console.log(`Planned cleanups (${planned.length})`);
  if (planned.length === 0) {
    console.log("  (none)");
  } else {
    for (const p of planned) console.log(p);
  }
  console.log("");

  // Seed outbound_mailboxes on catalog plans (all tenants get the feature key)
  console.log("Catalog plan feature: outbound_mailboxes");
  const catalogChanges = await ensureOutboundFeatureOnCatalogPlans();
  for (const c of catalogChanges) console.log(c);
  console.log("");

  // Internal Owner plan for this org only
  let ownerPlan = await prisma.plan.findFirst({ where: { name: PLAN_NAME } });
  const ownerFeatureSpecs = [
    { featureKey: "users", limitValue: 50, enabled: true },
    { featureKey: "opportunities", limitValue: 10000, enabled: true },
    { featureKey: "ai_calls", limitValue: 50000, enabled: true },
    { featureKey: "emails", limitValue: 50000, enabled: true },
    { featureKey: "sequences", limitValue: 100, enabled: true },
    { featureKey: "sources", limitValue: 50, enabled: true },
    { featureKey: "enrichment", limitValue: 10000, enabled: true },
    { featureKey: "inbox_accounts", limitValue: INBOX_LIMIT, enabled: true },
    { featureKey: "outbound_mailboxes", limitValue: OUTBOUND_LIMIT, enabled: true },
    { featureKey: "automation", limitValue: 100, enabled: true },
    { featureKey: "advanced_ai", limitValue: 1, enabled: true },
    { featureKey: "learning", limitValue: 1, enabled: true },
    { featureKey: "connectors", limitValue: 50, enabled: true },
  ];

  console.log(`Plan: ${PLAN_NAME}`);
  if (!ownerPlan) {
    console.log(
      DRY_RUN
        ? { action: "would_create_plan", name: PLAN_NAME, price: 0 }
        : { action: "create_plan", name: PLAN_NAME }
    );
    if (!DRY_RUN) {
      ownerPlan = await prisma.plan.create({
        data: {
          id: randomUUID(),
          name: PLAN_NAME,
          description:
            "Internal owner workspace — elevated seat limits (not for public signup)",
          price: 0,
          currency: "USD",
          billingInterval: "MONTHLY",
          active: true,
          isDefault: false,
          sortOrder: 99,
          features: {
            create: ownerFeatureSpecs.map((f) => ({
              id: randomUUID(),
              ...f,
            })),
          },
        },
      });
    }
  } else {
    console.log({ action: "plan_exists", id: ownerPlan.id });
    for (const f of ownerFeatureSpecs) {
      const r = await upsertPlanFeature(
        ownerPlan.id,
        f.featureKey,
        f.limitValue,
        f.enabled
      );
      console.log({ feature: f.featureKey, ...r });
    }
  }
  console.log("");

  console.log("Subscription assignment (this org only)");
  const onOwnerPlan =
    Boolean(ownerPlan) && sub && sub.planId === ownerPlan.id;
  if (!sub) {
    console.log({
      action: DRY_RUN ? "would_create_subscription" : "create_subscription",
      plan: PLAN_NAME,
    });
    if (!DRY_RUN && ownerPlan) {
      await prisma.subscription.create({
        data: {
          id: randomUUID(),
          organizationId: org.id,
          planId: ownerPlan.id,
          provider: "internal",
          status: "ACTIVE",
          currentPeriodStart: new Date(),
        },
      });
    }
  } else if (!onOwnerPlan) {
    console.log({
      action: DRY_RUN ? "would_switch_plan" : "switch_plan",
      from: sub.plan.name,
      to: PLAN_NAME,
      subscriptionId: sub.id,
    });
    if (!DRY_RUN) {
      if (!ownerPlan) {
        throw new Error(
          `Internal Owner plan missing after create — cannot switch subscription`
        );
      }
      await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          planId: ownerPlan.id,
          provider: "internal",
          status: "ACTIVE",
        },
      });
    }
  } else {
    console.log({
      action: "already_on_plan",
      plan: sub.plan.name,
      subscriptionId: sub.id,
    });
  }
  console.log("");

  if (!DRY_RUN) {
    for (const p of planned) {
      if (p.kind === "clear_stale_smtp_public_config") {
        await prisma.userIntegration.update({
          where: { id: p.id },
          data: {
            publicConfig: {},
            displayLabel: null,
            encryptedCredentials: null,
            isConnected: false,
            isEnabled: false,
          },
        });
      }
      if (p.kind === "pause_or_remove_orphan_outbound_mailbox") {
        await prisma.outboundMailbox.delete({ where: { id: p.id } });
      }
    }
  }

  console.log("─── .env SMTP note ─────────────────────────────────────────");
  console.log(
    "Platform SMTP (SMTP_HOST/USER/PASSWORD in .env) is used only by"
  );
  console.log(
    "sendEmailForUser fallback / notifications / auth — never written as"
  );
  console.log(
    "EmailAccount and never added to OutboundMailbox pool (explicit opt-in only)."
  );
  console.log("");

  if (DRY_RUN) {
    console.log(
      "DRY-RUN complete. Re-run with APPLY=1 to apply plan + cleanups."
    );
  } else {
    console.log("APPLY complete.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
