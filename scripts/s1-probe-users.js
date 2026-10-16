/* eslint-disable @typescript-eslint/no-require-imports */
require("./load-env");
const { ensureDatabaseUrl } = require("./database-url");
ensureDatabaseUrl();
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const users = await p.user.findMany({
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
    },
    orderBy: { createdAt: "asc" },
  });
  const orgs = await p.organization.findMany({
    select: { id: true, name: true, slug: true },
  });
  const plans = await p.plan.findMany({ select: { id: true, name: true, active: true } });
  const uis = await p.userIntegration.findMany({
    select: {
      id: true,
      platform: true,
      isConnected: true,
      encryptedCredentials: true,
      organizationId: true,
    },
  });
  const emails = await p.emailAccount.findMany({
    select: { id: true, email: true, provider: true, status: true },
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
        users: users.map((u) => ({
          ...u,
          email: u.email.replace(/^(.).+(@.+)$/, "$1***$2"),
        })),
        orgs,
        plans,
        userIntegrations: uis.map((x) => ({
          id: x.id,
          platform: x.platform,
          isConnected: x.isConnected,
          hasCreds: Boolean(x.encryptedCredentials),
          organizationId: x.organizationId,
        })),
        emailAccounts: emails.map((e) => ({
          ...e,
          email: e.email.replace(/^(.).+(@.+)$/, "$1***$2"),
        })),
        linkedIn: li.map((a) => ({
          id: a.id,
          connectionType: a.connectionType,
          hasLiAt: Boolean(a.liAtCookie),
          hasJsession: Boolean(a.jsessionId),
          hasOauth: Boolean(a.oauthAccessToken),
        })),
      },
      null,
      2
    )
  );
  await p.$disconnect();
})().catch(async (e) => {
  console.error(e.message || e);
  await p.$disconnect();
  process.exit(1);
});
