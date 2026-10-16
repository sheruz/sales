/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Post-APPLY verification (read-only). Masks emails.
 * Usage: node scripts/s1-verify.js
 */
require("./load-env");
const { ensureDatabaseUrl } = require("./database-url");
ensureDatabaseUrl();
const { PrismaClient } = require("@prisma/client");

function maskEmail(email) {
  if (!email) return null;
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const localMask =
    local.length <= 2
      ? `${local[0] ?? "*"}*`
      : `${local[0]}***${local[local.length - 1]}`;
  return `${localMask}@${domain}`;
}

async function main() {
  const p = new PrismaClient();
  try {
    const plans = await p.plan.findMany({
      select: { name: true, code: true, visibility: true, active: true },
      orderBy: { sortOrder: "asc" },
    });
    const sub = await p.subscription.findFirst({
      where: { organization: { name: "Default Workspace" } },
      include: { plan: { select: { name: true, code: true } } },
    });
    const users = await p.user.findMany({
      select: {
        email: true,
        platformRole: true,
        isActive: true,
        role: true,
      },
      orderBy: { createdAt: "asc" },
    });
    const ti = await p.tenantIntegration.findMany({
      select: {
        providerId: true,
        status: true,
        externalKey: true,
        managedModeEnabled: true,
      },
    });
    const li = await p.linkedInAccount.findMany({
      select: {
        id: true,
        connectionType: true,
        liAtCookie: true,
        jsessionId: true,
        oauthAccessToken: true,
      },
    });
    console.log(
      JSON.stringify(
        {
          plans,
          subscription: {
            plan: sub?.plan?.name ?? null,
            code: sub?.plan?.code ?? null,
            status: sub?.status ?? null,
          },
          users: users.map((u) => ({
            email: maskEmail(u.email),
            platformRole: u.platformRole,
            role: u.role,
            isActive: u.isActive,
          })),
          tenantIntegrations: ti,
          linkedIn: li.map((x) => ({
            id: x.id,
            type: x.connectionType,
            hasCookies: Boolean(x.liAtCookie || x.jsessionId),
            hasOauth: Boolean(x.oauthAccessToken),
          })),
          checks: {
            ownerPlan: plans.some((p) => p.code === "OWNER" || p.name === "OWNER"),
            defaultOnOwner: sub?.plan?.name === "OWNER" || sub?.plan?.code === "OWNER",
            platformSuperAdmin: users.some(
              (u) => u.platformRole === "SUPER_ADMIN" && u.isActive
            ),
            tiProviders: ti.map((t) => t.providerId).sort(),
            linkedInCookiesCleared: li.every(
              (x) => !x.liAtCookie && !x.jsessionId
            ),
          },
        },
        null,
        2
      )
    );
  } finally {
    await p.$disconnect();
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
