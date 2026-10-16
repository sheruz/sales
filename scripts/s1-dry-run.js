/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * S1 dry-run (READ-ONLY) — orgs, SUPER_ADMIN users, integrations to copy.
 *
 * Safety guarantees:
 * - Only Prisma find* / $queryRaw SELECT (no create/update/delete/upsert/$executeRaw).
 * - Uses CURRENT production schema only (no TenantIntegration, platformRole, etc.).
 * - Never prints secrets, ciphertext, tokens, or passwords — env keys = present true/false;
 *   emails are masked.
 *
 * Usage (on production host / with prod DATABASE_URL):
 *   node scripts/s1-dry-run.js
 *   node scripts/run-with-env.js node scripts/s1-dry-run.js
 */
require("./load-env");
const { PrismaClient } = require("@prisma/client");

const OWNER_ORG_NAME = process.env.OWNER_ORG_NAME || "Default Workspace";

/** Providers whose .env keys may later copy into Default Workspace TenantIntegration. */
const PLATFORM_ENV_PROVIDERS = [
  { providerId: "anthropic", envKeys: ["ANTHROPIC_API_KEY"], label: "Claude / Anthropic" },
  { providerId: "openai", envKeys: ["OPENAI_API_KEY"], label: "OpenAI" },
  { providerId: "google_places", envKeys: ["GOOGLE_PLACES_API_KEY", "GOOGLE_MAPS_API_KEY"], label: "Google Places" },
  { providerId: "pagespeed", envKeys: ["PAGESPEED_API_KEY", "GOOGLE_PAGESPEED_API_KEY"], label: "PageSpeed" },
  { providerId: "hunter", envKeys: ["HUNTER_API_KEY"], label: "Hunter" },
  { providerId: "smtp", envKeys: ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "SMTP_PASSWORD"], label: "Platform SMTP" },
  { providerId: "resend", envKeys: ["RESEND_API_KEY"], label: "Resend" },
  {
    providerId: "linkedin_session_env",
    envKeys: ["LINKEDIN_LI_AT", "LINKEDIN_JSESSIONID"],
    label: "LinkedIn SESSION env (NOT copied — S1 disables)",
  },
];

function maskEmail(email) {
  if (!email || typeof email !== "string") return null;
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const localMask = local.length <= 2 ? `${local[0] ?? "*"}*` : `${local[0]}***${local[local.length - 1]}`;
  return `${localMask}@${domain}`;
}

function envKeyPresent(...keys) {
  for (const k of keys) {
    const v = process.env[k];
    if (v && String(v).trim()) return { key: k, present: true };
  }
  return { key: keys[0], present: false };
}

/**
 * Guard: throw if any non-read Prisma call is attempted through this wrapper.
 * (Defense in depth — script only uses find* / $queryRaw.)
 */
function readOnlyPrisma() {
  const prisma = new PrismaClient();
  const forbidden = new Set([
    "create",
    "createMany",
    "update",
    "updateMany",
    "upsert",
    "delete",
    "deleteMany",
    "$executeRaw",
    "$executeRawUnsafe",
  ]);

  function wrapModel(model) {
    return new Proxy(model, {
      get(target, prop, receiver) {
        if (typeof prop === "string" && forbidden.has(prop)) {
          throw new Error(`s1-dry-run is READ-ONLY: blocked prisma.*.${prop}`);
        }
        return Reflect.get(target, prop, receiver);
      },
    });
  }

  return new Proxy(prisma, {
    get(target, prop, receiver) {
      if (typeof prop === "string" && forbidden.has(prop)) {
        throw new Error(`s1-dry-run is READ-ONLY: blocked prisma.${prop}`);
      }
      const value = Reflect.get(target, prop, receiver);
      if (
        value &&
        typeof value === "object" &&
        typeof prop === "string" &&
        !prop.startsWith("$") &&
        !prop.startsWith("_")
      ) {
        return wrapModel(value);
      }
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

async function main() {
  const prisma = readOnlyPrisma();
  const out = {
    meta: {
      generatedAt: new Date().toISOString(),
      readOnly: true,
      schemaMode: "current-production",
      notes: [
        "No writes. No S1 models/columns referenced.",
        "Secrets: presence flags only; emails masked; no ciphertext/tokens/passwords.",
        "APPLY is a separate script — this file never applies.",
      ],
    },
    ownerOrgName: OWNER_ORG_NAME,
    orgs: [],
    superAdminUsers: [],
    linkedInAccounts: [],
    integrationsToCopy: {
      ownerOrg: null,
      fromEnv: [],
      fromUserIntegrations: [],
      fromEmailAccounts: [],
      fromSourceConnectors: [],
      fromLinkedInOauthOnly: [],
      excludedSessionLinkedIn: [],
    },
    proposal: {
      defaultWorkspacePlan: "OWNER",
      otherOrgsPlan: "WAIT — do not auto-assign OWNER; propose Free/trial in shadow",
      platformRole: "Only your account → platformRole SUPER_ADMIN (script after approval)",
      linkedInCatalog: "OAuth-only; SESSION cookie rows NOT copied into TenantIntegration",
      linkedInSessionMode: "S1: LINKEDIN_SESSION_ENABLED=false (default) — refuse new SESSION, hide UI, no env cron fallback",
    },
  };

  try {
    // Current-schema models only: Organization, OrganizationUser, Role, User, Subscription, Plan
    const orgs = await prisma.organization.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        createdAt: true,
        subscriptions: {
          select: {
            status: true,
            planId: true,
            plan: { select: { name: true } },
          },
        },
        members: {
          where: { status: "ACTIVE" },
          select: {
            isPrimaryAdmin: true,
            role: { select: { key: true, name: true } },
            user: {
              select: {
                id: true,
                email: true,
                role: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    for (const o of orgs) {
      const sub = o.subscriptions[0] ?? null;
      const owner =
        o.members.find((m) => m.isPrimaryAdmin) ||
        o.members.find((m) => m.role?.key === "company_admin") ||
        o.members[0] ||
        null;
      out.orgs.push({
        id: o.id,
        name: o.name,
        slug: o.slug,
        status: o.status,
        createdAt: o.createdAt,
        memberCount: o.members.length,
        ownerEmail: maskEmail(owner?.user?.email),
        ownerUserId: owner?.user?.id ?? null,
        currentPlan: sub?.plan?.name ?? null,
        planId: sub?.planId ?? null,
        subscriptionStatus: sub?.status ?? null,
        isDefaultWorkspace: o.name === OWNER_ORG_NAME,
        proposedPlan:
          o.name === OWNER_ORG_NAME
            ? "OWNER"
            : "PENDING_YOUR_DECISION (shadow: Free/trial)",
        members: o.members.map((m) => ({
          email: maskEmail(m.user.email),
          name: `${m.user.firstName} ${m.user.lastName}`.trim(),
          orgRole: m.role?.key ?? null,
          userRole: m.user.role,
          isPrimaryAdmin: m.isPrimaryAdmin,
        })),
      });
    }

    const supers = await prisma.user.findMany({
      where: { role: "SUPER_ADMIN" },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        deletedAt: true,
        memberships: {
          where: { status: "ACTIVE" },
          select: {
            isPrimaryAdmin: true,
            organization: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    out.superAdminUsers = supers.map((u) => ({
      id: u.id,
      email: maskEmail(u.email),
      name: `${u.firstName} ${u.lastName}`.trim(),
      userRole: u.role,
      isActive: u.isActive,
      deletedAt: u.deletedAt,
      createdAt: u.createdAt,
      orgs: u.memberships.map((m) => ({
        orgId: m.organization.id,
        orgName: m.organization.name,
        isPrimaryAdmin: m.isPrimaryAdmin,
      })),
      willReceivePlatformRoleSuperAdmin: false,
    }));

    // Presence flags only — never select cookie/token ciphertext into the result shape
    const liRows = await prisma.$queryRaw`
      SELECT
        la.id,
        la.user_id AS "userId",
        la.connection_type AS "connectionType",
        la.is_active AS "isActive",
        (la.li_at_cookie IS NOT NULL) AS "hasLiAtCookie",
        (la.jsession_id IS NOT NULL) AS "hasJsessionId",
        (la.oauth_access_token IS NOT NULL) AS "hasOauthAccessToken",
        (la.oauth_refresh_token IS NOT NULL) AS "hasOauthRefreshToken",
        u.email AS "userEmail",
        la.linkedin_email AS "linkedInEmail",
        la.display_name AS "displayName"
      FROM linkedin_accounts la
      INNER JOIN users u ON u.id = la.user_id
    `;

    out.linkedInAccounts = [];
    for (const a of liRows) {
      const memberships = await prisma.organizationUser.findMany({
        where: { userId: a.userId, status: "ACTIVE" },
        select: { organization: { select: { name: true } } },
      });
      const isSession =
        a.connectionType === "SESSION" || Boolean(a.hasLiAtCookie);
      const row = {
        id: a.id,
        userId: a.userId,
        userEmail: maskEmail(a.userEmail),
        orgs: memberships.map((m) => m.organization.name),
        connectionType: a.connectionType,
        hasLiAtCookie: Boolean(a.hasLiAtCookie),
        hasJsessionId: Boolean(a.hasJsessionId),
        hasOauthAccessToken: Boolean(a.hasOauthAccessToken),
        hasOauthRefreshToken: Boolean(a.hasOauthRefreshToken),
        isActive: Boolean(a.isActive),
        linkedInEmail: maskEmail(a.linkedInEmail),
        displayName: a.displayName ?? null,
        catalogAction: isSession
          ? "EXCLUDE — session cookies / Voyager automation; not carried into TenantIntegration"
          : a.connectionType === "OAUTH"
            ? "ELIGIBLE — OAuth-only copy candidate after APPLY"
            : "REVIEW",
      };
      out.linkedInAccounts.push(row);
    }

    const ownerOrg = orgs.find((o) => o.name === OWNER_ORG_NAME) ?? null;
    out.integrationsToCopy.ownerOrg = ownerOrg
      ? { id: ownerOrg.id, name: ownerOrg.name, slug: ownerOrg.slug }
      : null;

    if (!ownerOrg) {
      console.error(`WARNING: Organization named "${OWNER_ORG_NAME}" not found.`);
    }

    for (const p of PLATFORM_ENV_PROVIDERS) {
      const hit = envKeyPresent(...p.envKeys);
      const isLinkedInSessionEnv = p.providerId === "linkedin_session_env";
      out.integrationsToCopy.fromEnv.push({
        providerId: p.providerId,
        label: p.label,
        targetOrganizationId: ownerOrg?.id ?? null,
        envKeyFound: hit.present ? hit.key : null,
        secretPresent: hit.present,
        action: isLinkedInSessionEnv
          ? hit.present
            ? "DO NOT COPY — SESSION env disabled in S1; remove from .env after deploy"
            : "SKIP — env key absent"
          : hit.present
            ? "COPY → TenantIntegration for Default Workspace only (after round-trip decrypt verify)"
            : "SKIP — env key absent",
      });
    }

    if (ownerOrg) {
      // UserIntegration: presence of encrypted_credentials only (no ciphertext)
      const uis = await prisma.$queryRaw`
        SELECT
          ui.id,
          ui.platform::text AS platform,
          ui.is_connected AS "isConnected",
          ui.is_enabled AS "isEnabled",
          (ui.encrypted_credentials IS NOT NULL) AS "hasEncryptedCredentials",
          ui.display_label AS "displayLabel",
          u.email AS "userEmail"
        FROM user_integrations ui
        INNER JOIN users u ON u.id = ui.user_id
        WHERE ui.organization_id = ${ownerOrg.id}
      `;
      out.integrationsToCopy.fromUserIntegrations = uis.map((ui) => ({
        id: ui.id,
        platform: ui.platform,
        userEmail: maskEmail(ui.userEmail),
        isConnected: Boolean(ui.isConnected),
        isEnabled: Boolean(ui.isEnabled),
        hasEncryptedCredentials: Boolean(ui.hasEncryptedCredentials),
        hasDisplayLabel: Boolean(ui.displayLabel),
        action: "DUAL-WRITE / COPY → TenantIntegration (providerId from platform)",
      }));

      const emails = await prisma.$queryRaw`
        SELECT
          ea.id,
          ea.email,
          ea.provider::text AS provider,
          ea.status::text AS status,
          (ea.encrypted_access_token IS NOT NULL) AS "hasAccessToken",
          (ea.encrypted_refresh_token IS NOT NULL) AS "hasRefreshToken",
          (ea.encrypted_smtp_password IS NOT NULL) AS "hasSmtpPassword",
          (ea.smtp_host IS NOT NULL AND length(trim(ea.smtp_host)) > 0) AS "hasSmtpHost",
          (ea.smtp_user IS NOT NULL AND length(trim(ea.smtp_user)) > 0) AS "hasSmtpUser"
        FROM email_accounts ea
        WHERE ea.organization_id = ${ownerOrg.id}
      `;
      out.integrationsToCopy.fromEmailAccounts = emails.map((e) => ({
        id: e.id,
        email: maskEmail(e.email),
        provider: e.provider,
        status: e.status,
        hasAccessToken: Boolean(e.hasAccessToken),
        hasRefreshToken: Boolean(e.hasRefreshToken),
        hasSmtpPassword: Boolean(e.hasSmtpPassword),
        hasSmtpHost: Boolean(e.hasSmtpHost),
        hasSmtpUser: Boolean(e.hasSmtpUser),
        action: "KEEP EmailAccount table; dual-write TI metadata only (no drop)",
      }));

      const connectors = await prisma.$queryRaw`
        SELECT
          sc.id,
          sc.type::text AS type,
          sc.name,
          sc.provider,
          sc.status::text AS status,
          (sc.credentials_encrypted IS NOT NULL) AS "hasCredentials"
        FROM source_connectors sc
        WHERE sc.organization_id = ${ownerOrg.id}
      `;
      out.integrationsToCopy.fromSourceConnectors = connectors.map((c) => ({
        id: c.id,
        type: c.type,
        name: c.name,
        provider: c.provider,
        status: c.status,
        hasCredentials: Boolean(c.hasCredentials),
        action: "KEEP SourceConnector; dual-write TI if applicable",
      }));
    }

    out.integrationsToCopy.fromLinkedInOauthOnly = out.linkedInAccounts.filter(
      (a) => a.catalogAction.startsWith("ELIGIBLE")
    );
    out.integrationsToCopy.excludedSessionLinkedIn = out.linkedInAccounts.filter(
      (a) => a.catalogAction.startsWith("EXCLUDE")
    );

    console.log(JSON.stringify(out, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e && e.message ? e.message : e);
  process.exit(1);
});
