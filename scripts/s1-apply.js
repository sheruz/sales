/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * S1 APPLY — runs only when APPLY=1.
 * Order: schema → plans → subscriptions → users → integrations → LinkedIn.
 *
 * Required:
 *   MY_SUPER_ADMIN_EMAIL
 *   MY_LOGIN_EMAIL
 *
 * Usage:
 *   node scripts/s1-apply-dry-run.js          # always first
 *   APPLY=1 node scripts/s1-apply.js
 */
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { randomUUID } = require("crypto");
const {
  createPrisma,
  OWNER_ORG_NAME,
  SEED_PASSWORD,
  maskEmail,
  isApply,
  tableExists,
} = require("./s1-lib");

const APPLY = isApply();
const MY_SUPER_ADMIN_EMAIL = (process.env.MY_SUPER_ADMIN_EMAIL || "").trim().toLowerCase();
const MY_LOGIN_EMAIL = (process.env.MY_LOGIN_EMAIL || "").trim().toLowerCase();
const LINKEDIN_ID_PREFIX = (process.env.LINKEDIN_ACCOUNT_ID_PREFIX || "a60c9588").toLowerCase();
const APP_URL = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

function encryptBlob(plain) {
  const keyRaw = process.env.ENCRYPTION_KEY;
  if (!keyRaw || keyRaw.length < 16) throw new Error("ENCRYPTION_KEY required");
  const key = crypto.createHash("sha256").update(keyRaw).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

function decryptBlob(payload) {
  const keyRaw = process.env.ENCRYPTION_KEY;
  if (!keyRaw || keyRaw.length < 16) throw new Error("ENCRYPTION_KEY required");
  const key = crypto.createHash("sha256").update(keyRaw).digest();
  const [ivHex, tagHex, dataHex] = String(payload).split(":");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivHex, "hex")
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

function roundTripOk(encrypted) {
  const plain = decryptBlob(encrypted);
  const again = encryptBlob(plain);
  return decryptBlob(again) === plain;
}

async function issuePasswordReset(prisma, userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  // Unknown random password — forces use of reset link
  const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });
  await prisma.session.deleteMany({ where: { userId } });
  await prisma.passwordResetToken.create({
    data: { id: randomUUID(), userId, tokenHash, expiresAt },
  });
  const url = `${APP_URL}/reset-password?token=${token}`;
  // Print once to stdout — never include in JSON summary
  console.error("\n========== ONE-TIME PASSWORD RESET (copy now; not stored in logs) ==========");
  console.error(`userId=${userId}`);
  console.error(url);
  console.error("===========================================================================\n");
  return { issued: true, expiresAt };
}

async function ensureUnlimitedOwnerPlan(prisma) {
  const features = [
    "users",
    "opportunities",
    "ai_calls",
    "emails",
    "sequences",
    "sources",
    "enrichment",
    "inbox_accounts",
    "outbound_mailboxes",
    "automation",
    "advanced_ai",
    "learning",
    "connectors",
  ];
  let plan = await prisma.plan.findFirst({
    where: { OR: [{ code: "OWNER" }, { name: "OWNER" }] },
  });
  if (!plan) {
    plan = await prisma.plan.create({
      data: {
        id: randomUUID(),
        name: "OWNER",
        code: "OWNER",
        description: "Internal unlimited owner plan (Delvix)",
        price: 0,
        currency: "USD",
        billingInterval: "MONTHLY",
        active: true,
        isDefault: false,
        sortOrder: -1,
        visibility: "INTERNAL",
      },
    });
  } else {
    await prisma.plan.update({
      where: { id: plan.id },
      data: {
        name: "OWNER",
        code: "OWNER",
        visibility: "INTERNAL",
        active: true,
        isDefault: false,
      },
    });
  }
  for (const featureKey of features) {
    await prisma.planFeature.upsert({
      where: { planId_featureKey: { planId: plan.id, featureKey } },
      create: {
        id: randomUUID(),
        planId: plan.id,
        featureKey,
        limitValue: null,
        enabled: true,
      },
      update: { limitValue: null, enabled: true },
    });
  }

  const internal = await prisma.plan.findFirst({ where: { name: "Internal Owner" } });
  if (internal && internal.id !== plan.id) {
    await prisma.subscription.updateMany({
      where: { planId: internal.id },
      data: { planId: plan.id },
    });
    await prisma.plan.update({
      where: { id: internal.id },
      data: { active: false },
    });
  }

  // Draft plans
  for (const draft of [
    { name: "Starter", code: "STARTER", price: 49, sortOrder: 10 },
    { name: "Agency", code: "AGENCY", price: 399, sortOrder: 30 },
  ]) {
    const existing = await prisma.plan.findFirst({
      where: { OR: [{ code: draft.code }, { name: draft.name }] },
    });
    if (!existing) {
      await prisma.plan.create({
        data: {
          id: randomUUID(),
          name: draft.name,
          code: draft.code,
          description: `${draft.name} draft (limits editable later)`,
          price: draft.price,
          currency: "USD",
          billingInterval: "MONTHLY",
          active: false,
          isDefault: false,
          sortOrder: draft.sortOrder,
          visibility: "DRAFT",
        },
      });
    } else {
      await prisma.plan.update({
        where: { id: existing.id },
        data: { code: draft.code, visibility: "DRAFT" },
      });
    }
  }

  return plan;
}

async function main() {
  if (!APPLY) {
    console.log(
      JSON.stringify(
        {
          error: "Refusing to apply. Run dry-run first, then APPLY=1 node scripts/s1-apply.js",
          dryRun: "node scripts/s1-apply-dry-run.js",
        },
        null,
        2
      )
    );
    process.exit(1);
  }
  if (!MY_SUPER_ADMIN_EMAIL || !MY_LOGIN_EMAIL) {
    console.error("MY_SUPER_ADMIN_EMAIL and MY_LOGIN_EMAIL are required for APPLY");
    process.exit(1);
  }

  console.log("=== S1 APPLY: running schema migrate ===");
  const { spawnSync } = require("child_process");
  const mig = spawnSync(
    process.execPath,
    ["scripts/s1-schema-migrate.js"],
    {
      cwd: require("path").join(__dirname, ".."),
      env: { ...process.env, APPLY: "1" },
      stdio: "inherit",
    }
  );
  if (mig.status !== 0) process.exit(mig.status ?? 1);

  const prisma = createPrisma();
  const summary = { plans: null, subscription: null, users: [], integrations: [], linkedIn: [] };

  try {
    if (!(await tableExists(prisma, "tenant_integrations"))) {
      throw new Error("tenant_integrations missing after schema migrate");
    }

    console.log("=== plans ===");
    const ownerPlan = await ensureUnlimitedOwnerPlan(prisma);
    summary.plans = { ownerPlanId: ownerPlan.id, name: "OWNER" };

    const ownerOrg = await prisma.organization.findFirst({
      where: { name: OWNER_ORG_NAME, deletedAt: null },
    });
    if (!ownerOrg) throw new Error(`Org ${OWNER_ORG_NAME} not found`);

    console.log("=== subscriptions ===");
    await prisma.subscription.upsert({
      where: { organizationId: ownerOrg.id },
      create: {
        id: randomUUID(),
        organizationId: ownerOrg.id,
        planId: ownerPlan.id,
        provider: "internal",
        status: "ACTIVE",
        currentPeriodStart: new Date(),
      },
      update: {
        planId: ownerPlan.id,
        status: "ACTIVE",
        provider: "internal",
      },
    });
    summary.subscription = { organizationId: ownerOrg.id, plan: "OWNER" };

    console.log("=== users ===");
    const superSeed = await prisma.user.findUnique({
      where: { email: "superadmin@salesplatform.local" },
    });
    if (!superSeed) throw new Error("Seed Super Admin not found");
    const emailTaken = await prisma.user.findUnique({
      where: { email: MY_SUPER_ADMIN_EMAIL },
    });
    if (emailTaken && emailTaken.id !== superSeed.id) {
      throw new Error("MY_SUPER_ADMIN_EMAIL already used by another user");
    }
    await prisma.user.update({
      where: { id: superSeed.id },
      data: {
        email: MY_SUPER_ADMIN_EMAIL,
        platformRole: "SUPER_ADMIN",
        role: "SUPER_ADMIN",
        isActive: true,
      },
    });
    await issuePasswordReset(prisma, superSeed.id);
    summary.users.push({
      id: superSeed.id,
      email: maskEmail(MY_SUPER_ADMIN_EMAIL),
      platformRole: "SUPER_ADMIN",
    });

    const adminSeed = await prisma.user.findUnique({
      where: { email: "admin@salesplatform.local" },
    });
    if (!adminSeed) throw new Error("Seed Admin User not found");
    const loginTaken = await prisma.user.findUnique({
      where: { email: MY_LOGIN_EMAIL },
    });
    if (loginTaken && loginTaken.id !== adminSeed.id) {
      throw new Error("MY_LOGIN_EMAIL already used by another user");
    }
    await prisma.user.update({
      where: { id: adminSeed.id },
      data: {
        email: MY_LOGIN_EMAIL,
        platformRole: null,
        isActive: true,
      },
    });
    await issuePasswordReset(prisma, adminSeed.id);
    summary.users.push({
      id: adminSeed.id,
      email: maskEmail(MY_LOGIN_EMAIL),
      platformRole: null,
    });

    for (const email of ["manager@salesplatform.local", "rep@salesplatform.local"]) {
      const u = await prisma.user.findUnique({ where: { email } });
      if (u && u.isActive) {
        await prisma.user.update({
          where: { id: u.id },
          data: { isActive: false },
        });
        summary.users.push({
          id: u.id,
          email: maskEmail(email),
          deactivated: true,
        });
      }
    }

    console.log("=== integrations copy ===");
    const copyPlatforms = {
      ANTHROPIC: "anthropic",
      GOOGLE_PLACES: "google_places",
      HUNTER: "hunter",
    };
    const uis = await prisma.userIntegration.findMany({
      where: {
        organizationId: ownerOrg.id,
        isConnected: true,
        platform: { in: Object.keys(copyPlatforms) },
      },
    });
    for (const ui of uis) {
      if (!ui.encryptedCredentials) continue;
      if (!roundTripOk(ui.encryptedCredentials)) {
        throw new Error(`Decrypt round-trip failed for UserIntegration ${ui.id}`);
      }
      const providerId = copyPlatforms[ui.platform];
      const id = randomUUID();
      await prisma.tenantIntegration.upsert({
        where: {
          organizationId_providerId_externalKey: {
            organizationId: ownerOrg.id,
            providerId,
            externalKey: "default",
          },
        },
        create: {
          id,
          organizationId: ownerOrg.id,
          providerId,
          externalKey: "default",
          status: "CONNECTED",
          encryptedCredentials: ui.encryptedCredentials,
          keyMode: "BYOK",
          managedModeEnabled: false,
          connectedByUserId: ui.userId,
          legacySource: "UserIntegration",
          legacySourceId: ui.id,
        },
        update: {
          status: "CONNECTED",
          encryptedCredentials: ui.encryptedCredentials,
          keyMode: "BYOK",
          managedModeEnabled: false,
          legacySource: "UserIntegration",
          legacySourceId: ui.id,
        },
      });
      summary.integrations.push({ providerId, source: "UserIntegration", sourceId: ui.id });
    }

    const gmails = await prisma.emailAccount.findMany({
      where: {
        organizationId: ownerOrg.id,
        provider: "GMAIL",
        status: "ACTIVE",
      },
    });
    for (const ea of gmails) {
      if (!ea.encryptedAccessToken) continue;
      const creds = encryptBlob(
        JSON.stringify({
          accessTokenEnc: ea.encryptedAccessToken,
          refreshTokenEnc: ea.encryptedRefreshToken,
          tokenExpiresAt: ea.tokenExpiresAt,
          email: ea.email,
        })
      );
      await prisma.tenantIntegration.upsert({
        where: {
          organizationId_providerId_externalKey: {
            organizationId: ownerOrg.id,
            providerId: "gmail",
            externalKey: ea.email.toLowerCase(),
          },
        },
        create: {
          id: randomUUID(),
          organizationId: ownerOrg.id,
          providerId: "gmail",
          externalKey: ea.email.toLowerCase(),
          label: ea.email,
          status: "CONNECTED",
          encryptedCredentials: creds,
          oauthMode: "PLATFORM_APP",
          keyMode: "BYOK",
          managedModeEnabled: false,
          connectedByUserId: ea.userId,
          legacySource: "EmailAccount",
          legacySourceId: ea.id,
          publicConfig: { email: ea.email, provider: "GMAIL" },
        },
        update: {
          status: "CONNECTED",
          encryptedCredentials: creds,
          publicConfig: { email: ea.email, provider: "GMAIL" },
          legacySource: "EmailAccount",
          legacySourceId: ea.id,
        },
      });
      summary.integrations.push({
        providerId: "gmail",
        source: "EmailAccount",
        sourceId: ea.id,
        email: maskEmail(ea.email),
      });
    }

    console.log("=== LinkedIn ===");
    const liAccounts = await prisma.linkedInAccount.findMany();
    for (const a of liAccounts) {
      const idMatch = a.id.toLowerCase().startsWith(LINKEDIN_ID_PREFIX);
      const isOauth = a.connectionType === "OAUTH" && a.oauthAccessToken;
      if (isOauth && (idMatch || liAccounts.filter((x) => x.oauthAccessToken).length === 1)) {
        if (!roundTripOk(a.oauthAccessToken)) {
          throw new Error(`LinkedIn OAuth decrypt failed for ${a.id}`);
        }
        const creds = encryptBlob(
          JSON.stringify({
            accessTokenEnc: a.oauthAccessToken,
            refreshTokenEnc: a.oauthRefreshToken,
            expiresAt: a.oauthExpiresAt,
            memberId: a.linkedInMemberId,
          })
        );
        // Find org via user membership
        const membership = await prisma.organizationUser.findFirst({
          where: { userId: a.userId, status: "ACTIVE", organizationId: ownerOrg.id },
        });
        const orgId = membership?.organizationId || ownerOrg.id;
        await prisma.tenantIntegration.upsert({
          where: {
            organizationId_providerId_externalKey: {
              organizationId: orgId,
              providerId: "linkedin",
              externalKey: "default",
            },
          },
          create: {
            id: randomUUID(),
            organizationId: orgId,
            providerId: "linkedin",
            externalKey: "default",
            status: "CONNECTED",
            encryptedCredentials: creds,
            oauthMode: "PLATFORM_APP",
            keyMode: "BYOK",
            managedModeEnabled: false,
            connectedByUserId: a.userId,
            legacySource: "LinkedInAccount",
            legacySourceId: a.id,
            tokenExpiresAt: a.oauthExpiresAt,
            publicConfig: {
              linkedInEmail: a.linkedInEmail,
              displayName: a.displayName,
            },
          },
          update: {
            status: "CONNECTED",
            encryptedCredentials: creds,
            tokenExpiresAt: a.oauthExpiresAt,
            legacySource: "LinkedInAccount",
            legacySourceId: a.id,
          },
        });
        summary.linkedIn.push({ id: a.id, copiedOauthToTi: true });
      }
      if (a.liAtCookie || a.jsessionId) {
        await prisma.linkedInAccount.update({
          where: { id: a.id },
          data: { liAtCookie: null, jsessionId: null },
        });
        summary.linkedIn.push({ id: a.id, nulledCookies: true });
      }
    }

    console.log(JSON.stringify({ ok: true, summary }, null, 2));
    console.error("S1 APPLY complete. Set passwords via the one-time reset links printed above.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
