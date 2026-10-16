/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * S1 APPLY dry-run (READ-ONLY). Plans schema + plans + users + integrations + LinkedIn.
 * Never writes. Secrets: presence / decrypt-ok only; emails masked.
 *
 * Required env for user phase planning:
 *   MY_SUPER_ADMIN_EMAIL=you@example.com
 *   MY_LOGIN_EMAIL=you@example.com
 *
 * Usage:
 *   node scripts/s1-apply-dry-run.js
 */
const bcrypt = require("bcryptjs");
const {
  createPrisma,
  OWNER_ORG_NAME,
  SEED_PASSWORD,
  SEED_EMAILS,
  maskEmail,
  columnExists,
  tableExists,
} = require("./s1-lib");

const MY_SUPER_ADMIN_EMAIL = (process.env.MY_SUPER_ADMIN_EMAIL || "").trim().toLowerCase();
const MY_LOGIN_EMAIL = (process.env.MY_LOGIN_EMAIL || "").trim().toLowerCase();
const LINKEDIN_ID_PREFIX = (process.env.LINKEDIN_ACCOUNT_ID_PREFIX || "a60c9588").toLowerCase();

const UI_TO_PROVIDER = {
  ANTHROPIC: "anthropic",
  GOOGLE_PLACES: "google_places",
  HUNTER: "hunter",
  OPENAI: "openai",
  LINKEDIN: "linkedin",
  EMAIL_SMTP: "smtp",
};

async function tryDecryptRoundTrip(encrypted) {
  if (!encrypted) return { ok: false, reason: "empty" };
  try {
    // Use crypto helpers without importing TS env proxy when possible
    const crypto = require("crypto");
    const keyRaw = process.env.ENCRYPTION_KEY;
    if (!keyRaw || keyRaw.length < 16) {
      return { ok: false, reason: "ENCRYPTION_KEY missing" };
    }
    const key = crypto.createHash("sha256").update(keyRaw).digest();
    const [ivHex, tagHex, dataHex] = String(encrypted).split(":");
    if (!ivHex || !tagHex || !dataHex) return { ok: false, reason: "invalid_blob" };
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(ivHex, "hex")
    );
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(dataHex, "hex")),
      decipher.final(),
    ]).toString("utf8");
    // Re-encrypt and decrypt again for round-trip
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    const blob = `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
    const [iv2, tag2, data2] = blob.split(":");
    const d2 = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv2, "hex"));
    d2.setAuthTag(Buffer.from(tag2, "hex"));
    const plain2 = Buffer.concat([
      d2.update(Buffer.from(data2, "hex")),
      d2.final(),
    ]).toString("utf8");
    return { ok: plain2 === plain && plain.length > 0, reason: plain2 === plain ? "round_trip_ok" : "mismatch" };
  } catch (e) {
    return { ok: false, reason: e.message || "decrypt_failed" };
  }
}

async function main() {
  const prisma = createPrisma();
  const out = {
    meta: {
      generatedAt: new Date().toISOString(),
      readOnly: true,
      mode: "APPLY_DRY_RUN",
      ownerOrgName: OWNER_ORG_NAME,
      mySuperAdminEmailSet: Boolean(MY_SUPER_ADMIN_EMAIL),
      myLoginEmailSet: Boolean(MY_LOGIN_EMAIL),
      mySuperAdminEmailMasked: MY_SUPER_ADMIN_EMAIL ? maskEmail(MY_SUPER_ADMIN_EMAIL) : null,
      myLoginEmailMasked: MY_LOGIN_EMAIL ? maskEmail(MY_LOGIN_EMAIL) : null,
      warnings: [],
      applyOrder: [
        "1 schema migrate",
        "2 plans (OWNER + drafts)",
        "3 subscriptions (Default Workspace → OWNER)",
        "4 users/roles/password resets",
        "5 integrations copy → TenantIntegration",
        "6 LinkedIn cookie NULL cleanup",
      ],
    },
    schema: { planned: [] },
    plans: { planned: [] },
    subscriptions: { planned: [] },
    users: { planned: [], seedPasswordFlags: [], deactivate: [] },
    integrations: { copy: [], skip: [], envPolicy: [] },
    linkedIn: { planned: [] },
  };

  if (!MY_SUPER_ADMIN_EMAIL) {
    out.meta.warnings.push("Set MY_SUPER_ADMIN_EMAIL before APPLY (user phase blocked until set).");
  }
  if (!MY_LOGIN_EMAIL) {
    out.meta.warnings.push("Set MY_LOGIN_EMAIL before APPLY (admin email change blocked until set).");
  }

  try {
    const hasPlatformRole = await columnExists(prisma, "users", "platform_role");
    const hasTi = await tableExists(prisma, "tenant_integrations");
    const hasPlanCode = await columnExists(prisma, "plans", "code");
    out.schema.planned = [
      {
        action: hasPlatformRole ? "skip" : "add_column",
        item: "users.platform_role (PlatformRole)",
      },
      {
        action: hasPlanCode ? "skip" : "add_column",
        item: "plans.code + plans.visibility",
      },
      {
        action: hasTi ? "skip" : "create_table",
        item: "tenant_integrations",
      },
      { action: (await tableExists(prisma, "usage_events")) ? "skip" : "create_table", item: "usage_events" },
      {
        action: (await tableExists(prisma, "platform_audit_logs")) ? "skip" : "create_table",
        item: "platform_audit_logs",
      },
      { action: "ensure_enum", item: "PlatformRole, PlanVisibility, TenantIntegrationStatus, IntegrationOAuthMode, IntegrationKeyMode, SubscriptionStatus.SUSPENDED" },
    ];

    const ownerOrg = await prisma.organization.findFirst({
      where: { name: OWNER_ORG_NAME, deletedAt: null },
      select: { id: true, name: true, slug: true },
    });
    if (!ownerOrg) {
      out.meta.warnings.push(`Organization "${OWNER_ORG_NAME}" not found — plans/integrations blocked.`);
    }

    const plans = await prisma.plan.findMany({
      select: { id: true, name: true, active: true, isDefault: true },
    });
    const internalOwner = plans.find((p) => p.name === "Internal Owner");
    const ownerPlan = plans.find((p) => p.name === "OWNER" || p.name === "Owner");
    out.plans.planned.push({
      action: ownerPlan ? "ensure_OWNER_features" : "create_OWNER",
      name: "OWNER",
      code: "OWNER",
      visibility: "INTERNAL",
      unlimited: true,
      replace: internalOwner
        ? { id: internalOwner.id, name: "Internal Owner", action: "deactivate_or_migrate_subs_then_inactive" }
        : null,
    });
    for (const draft of [
      { name: "Starter", code: "STARTER", visibility: "DRAFT" },
      { name: "Agency", code: "AGENCY", visibility: "DRAFT" },
    ]) {
      const existing = plans.find((p) => p.name === draft.name);
      out.plans.planned.push({
        action: existing ? "ensure_draft_features" : "create_draft",
        ...draft,
        note: "Draft — not auto-assigned",
      });
    }
    out.plans.planned.push({
      action: "keep",
      names: ["Free", "Growth", "Scale"],
      note: "Existing catalog kept; Stripe left disabled",
    });

    if (ownerOrg) {
      const sub = await prisma.subscription.findUnique({
        where: { organizationId: ownerOrg.id },
        include: { plan: { select: { id: true, name: true } } },
      });
      out.subscriptions.planned.push({
        organizationId: ownerOrg.id,
        organizationName: ownerOrg.name,
        currentPlan: sub?.plan?.name ?? null,
        action: sub?.plan?.name === "OWNER" ? "unchanged" : "set_plan_OWNER",
        subscriptionStatus: sub?.status ?? "would_create_ACTIVE",
      });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        passwordHash: true,
        deletedAt: true,
        memberships: {
          where: { status: "ACTIVE" },
          select: {
            isPrimaryAdmin: true,
            organization: { select: { name: true } },
            role: { select: { key: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    for (const u of users) {
      const usesSeedPassword = await bcrypt.compare(SEED_PASSWORD, u.passwordHash);
      if (usesSeedPassword || SEED_EMAILS.includes(u.email.toLowerCase())) {
        out.users.seedPasswordFlags.push({
          id: u.id,
          email: maskEmail(u.email),
          name: `${u.firstName} ${u.lastName}`.trim(),
          usesSeedPassword,
          isSeedEmail: SEED_EMAILS.includes(u.email.toLowerCase()),
          role: u.role,
          isActive: u.isActive,
        });
      }
    }

    const superSeed = users.find(
      (u) => u.email.toLowerCase() === "superadmin@salesplatform.local"
    );
    const adminSeed = users.find(
      (u) => u.email.toLowerCase() === "admin@salesplatform.local"
    );
    const manager = users.find(
      (u) =>
        u.email.toLowerCase() === "manager@salesplatform.local" ||
        (`${u.firstName} ${u.lastName}`.trim() === "Sales Manager" &&
          u.email.endsWith("@salesplatform.local"))
    );
    const rep = users.find(
      (u) =>
        u.email.toLowerCase() === "rep@salesplatform.local" ||
        (`${u.firstName} ${u.lastName}`.trim() === "Sales Rep" &&
          u.email.endsWith("@salesplatform.local"))
    );

    out.users.planned.push({
      target: "platform_super_admin",
      from: superSeed
        ? {
            id: superSeed.id,
            email: maskEmail(superSeed.email),
            name: `${superSeed.firstName} ${superSeed.lastName}`,
            userRole: superSeed.role,
          }
        : null,
      toEmail: MY_SUPER_ADMIN_EMAIL ? maskEmail(MY_SUPER_ADMIN_EMAIL) : "<MY_SUPER_ADMIN_EMAIL>",
      actions: [
        "change email to MY_SUPER_ADMIN_EMAIL",
        "invalidate sessions",
        "set random unknown passwordHash (old Admin@123 dies)",
        "create one-time PasswordResetToken; print reset URL once to stdout (NOT logged in JSON)",
        "set platformRole=SUPER_ADMIN (after schema)",
        "Do NOT leave platformRole on seed email as-is",
      ],
      blocked: !MY_SUPER_ADMIN_EMAIL || !superSeed,
    });

    out.users.planned.push({
      target: "default_workspace_primary_admin",
      from: adminSeed
        ? {
            id: adminSeed.id,
            email: maskEmail(adminSeed.email),
            name: `${adminSeed.firstName} ${adminSeed.lastName}`,
            isPrimaryAdmin: adminSeed.memberships.some((m) => m.isPrimaryAdmin),
          }
        : null,
      toEmail: MY_LOGIN_EMAIL ? maskEmail(MY_LOGIN_EMAIL) : "<MY_LOGIN_EMAIL>",
      actions: [
        "change email to MY_LOGIN_EMAIL",
        "invalidate sessions",
        "password reset via one-time link (same as above)",
        "keep org primary admin membership",
        "platformRole stays null (tenant admin)",
      ],
      blocked: !MY_LOGIN_EMAIL || !adminSeed,
    });

    for (const u of [manager, rep].filter(Boolean)) {
      out.users.deactivate.push({
        id: u.id,
        email: maskEmail(u.email),
        name: `${u.firstName} ${u.lastName}`.trim(),
        currentIsActive: u.isActive,
        action: u.isActive
          ? "set isActive=false (no delete)"
          : "already inactive",
      });
    }

    // Integrations
    out.integrations.envPolicy = [
      {
        provider: "anthropic",
        policy: "Copy from UserIntegration only; skip .env if UI row exists (no duplicates)",
      },
      {
        provider: "smtp_platform",
        policy: "Platform SMTP in .env stays PLATFORM system sender — NOT copied to TenantIntegration",
      },
      {
        provider: "linkedin_session_env",
        policy: "LINKEDIN_SESSION_ENABLED=false; env cookies never copied",
      },
    ];

    if (ownerOrg) {
      const uis = await prisma.userIntegration.findMany({
        where: { organizationId: ownerOrg.id },
        select: {
          id: true,
          platform: true,
          isConnected: true,
          isEnabled: true,
          encryptedCredentials: true,
          displayLabel: true,
          userId: true,
        },
      });

      const copyPlatforms = new Set(["ANTHROPIC", "GOOGLE_PLACES", "HUNTER"]);
      for (const ui of uis) {
        const providerId = UI_TO_PROVIDER[ui.platform] || ui.platform.toLowerCase();
        if (!copyPlatforms.has(ui.platform)) {
          if (ui.platform === "EMAIL_SMTP") {
            out.integrations.skip.push({
              source: "UserIntegration",
              id: ui.id,
              platform: ui.platform,
              reason:
                !ui.isConnected || !ui.encryptedCredentials
                  ? "EMAIL_SMTP not connected / no creds — skip"
                  : "EMAIL_SMTP handled via EmailAccount dual-write, not UI row",
            });
          } else if (ui.platform === "LINKEDIN") {
            out.integrations.skip.push({
              source: "UserIntegration",
              id: ui.id,
              platform: ui.platform,
              reason: "LinkedIn TI comes from LinkedInAccount OAuth tokens, not UserIntegration blob",
            });
          } else {
            out.integrations.skip.push({
              source: "UserIntegration",
              id: ui.id,
              platform: ui.platform,
              reason: "not in copy list for this APPLY",
            });
          }
          continue;
        }
        if (!ui.isConnected || !ui.encryptedCredentials) {
          out.integrations.skip.push({
            source: "UserIntegration",
            id: ui.id,
            platform: ui.platform,
            reason: "inactive or empty credentials",
          });
          continue;
        }
        const rt = await tryDecryptRoundTrip(ui.encryptedCredentials);
        out.integrations.copy.push({
          source: "UserIntegration",
          sourceId: ui.id,
          platform: ui.platform,
          providerId,
          externalKey: "default",
          organizationId: ownerOrg.id,
          decryptRoundTripOk: rt.ok,
          decryptReason: rt.reason,
          action: rt.ok
            ? "COPY encrypted blob → TenantIntegration (CONNECTED, BYOK, managedModeEnabled=false)"
            : "BLOCKED — fix ENCRYPTION_KEY / blob before APPLY",
        });
      }

      const emails = await prisma.emailAccount.findMany({
        where: { organizationId: ownerOrg.id },
        select: {
          id: true,
          email: true,
          provider: true,
          status: true,
          encryptedAccessToken: true,
          encryptedRefreshToken: true,
          encryptedSmtpPassword: true,
        },
      });
      for (const ea of emails) {
        const activeGmail =
          ea.provider === "GMAIL" &&
          ea.status === "ACTIVE" &&
          Boolean(ea.encryptedAccessToken);
        if (activeGmail) {
          out.integrations.copy.push({
            source: "EmailAccount",
            sourceId: ea.id,
            email: maskEmail(ea.email),
            provider: ea.provider,
            providerId: "gmail",
            externalKey: ea.email.toLowerCase(),
            organizationId: ownerOrg.id,
            hasAccessToken: true,
            hasRefreshToken: Boolean(ea.encryptedRefreshToken),
            action:
              "DUAL-WRITE TI metadata (provider gmail, status CONNECTED, legacySource=EmailAccount) — keep EmailAccount row",
          });
          continue;
        }
        out.integrations.skip.push({
          source: "EmailAccount",
          id: ea.id,
          email: maskEmail(ea.email),
          provider: ea.provider,
          status: ea.status,
          reason:
            ea.status !== "ACTIVE"
              ? "DISCONNECTED/inactive — skip"
              : "not ACTIVE Gmail with tokens — skip",
        });
      }

      // Env anthropic only if no UI copy planned
      const hasAnthropicCopy = out.integrations.copy.some(
        (c) => c.providerId === "anthropic"
      );
      const envAnthropic = Boolean(
        process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.trim()
      );
      out.integrations.envPolicy.push({
        provider: "anthropic_env",
        secretPresent: envAnthropic,
        action: hasAnthropicCopy
          ? "SKIP .env copy — UserIntegration exists"
          : envAnthropic
            ? "would copy .env → TI (no UI row)"
            : "SKIP — no .env key",
      });
    }

    // LinkedIn
    const liAccounts = await prisma.linkedInAccount.findMany({
      select: {
        id: true,
        userId: true,
        connectionType: true,
        liAtCookie: true,
        jsessionId: true,
        oauthAccessToken: true,
        oauthRefreshToken: true,
        oauthExpiresAt: true,
        linkedInEmail: true,
        displayName: true,
        isActive: true,
        user: { select: { email: true } },
      },
    });
    for (const a of liAccounts) {
      const idMatch = a.id.toLowerCase().startsWith(LINKEDIN_ID_PREFIX);
      const isOauth =
        a.connectionType === "OAUTH" && Boolean(a.oauthAccessToken);
      const hasCookies = Boolean(a.liAtCookie) || Boolean(a.jsessionId);

      if (isOauth && (idMatch || liAccounts.length === 1)) {
        const oauthRt = await tryDecryptRoundTrip(a.oauthAccessToken);
        out.linkedIn.planned.push({
          id: a.id,
          userEmail: maskEmail(a.user.email),
          connectionType: a.connectionType,
          actions: [
            {
              step: "copy_oauth_to_TI",
              providerId: "linkedin",
              externalKey: "default",
              oauthMode: "PLATFORM_APP",
              decryptRoundTripOk: oauthRt.ok,
              includeRefreshToken: Boolean(a.oauthRefreshToken),
              note: "OAuth tokens only — never copy liAtCookie/jsessionId into TI",
            },
            {
              step: "null_session_cookies_on_legacy_row",
              fields: ["liAtCookie", "jsessionId"],
              currentlyHasCookies: hasCookies,
              keepRow: true,
            },
          ],
        });
      } else if (hasCookies) {
        out.linkedIn.planned.push({
          id: a.id,
          userEmail: maskEmail(a.user.email),
          connectionType: a.connectionType,
          actions: [
            {
              step: "null_session_cookies_on_legacy_row",
              fields: ["liAtCookie", "jsessionId"],
              currentlyHasCookies: hasCookies,
              keepRow: true,
              note: "SESSION row — no TI copy",
            },
          ],
        });
      } else {
        out.linkedIn.planned.push({
          id: a.id,
          userEmail: maskEmail(a.user.email),
          connectionType: a.connectionType,
          actions: [{ step: "skip", reason: "no OAuth match / no cookies" }],
        });
      }
    }
    out.linkedIn.sessionFlag = {
      LINKEDIN_SESSION_ENABLED: false,
      note: "Refuse new SESSION connects; no env cron fallback",
    };

    console.log(JSON.stringify(out, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
