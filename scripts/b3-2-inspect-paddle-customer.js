/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Inspect Paddle customer email for a tenant (Beenish QA).
 * Usage: node scripts/b3-2-inspect-paddle-customer.js --email=beenishshahid514@gmail.com
 */
require("./load-env");
const { ensureDatabaseUrl } = require("./database-url");
ensureDatabaseUrl();
const { createPrisma } = require("./s2-lib");

async function paddleGet(path) {
  // Prefer DB PaymentProviderConfig via a tiny inline decrypt is heavy —
  // use env fallbacks if present for ops scripts.
  const key =
    process.env.PADDLE_API_KEY ||
    process.env.PADDLE_SANDBOX_API_KEY ||
    "";
  if (!key) {
    return { error: "No PADDLE_API_KEY in env — check SA Payments config on server" };
  }
  const base = key.includes("_live_")
    ? "https://api.paddle.com"
    : "https://sandbox-api.paddle.com";
  const res = await fetch(`${base}${path}`, {
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

async function main() {
  const emailArg = process.argv
    .find((a) => a.startsWith("--email="))
    ?.slice("--email=".length);
  if (!emailArg) {
    console.error("Usage: --email=owner@example.com");
    process.exit(1);
  }
  const prisma = createPrisma();
  try {
    const user = await prisma.user.findFirst({
      where: { email: { equals: emailArg, mode: "insensitive" } },
    });
    if (!user) {
      console.log(JSON.stringify({ error: "user not found", email: emailArg }));
      return;
    }
    const mem = await prisma.organizationUser.findFirst({
      where: { userId: user.id },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            billingEmail: true,
            billingContactName: true,
            paddleCustomerId: true,
            paddleCustomerEnv: true,
          },
        },
      },
    });
    const org = mem?.organization;
    let paddle = null;
    if (org?.paddleCustomerId) {
      paddle = await paddleGet(`/customers/${org.paddleCustomerId}`);
    }
    console.log(
      JSON.stringify(
        {
          ownerEmail: user.email,
          organization: org,
          paddleCustomerApi: paddle,
          note:
            "Sandbox: Paddle may forward receipts for non-account-domain emails to the seller mailbox (info@…). Customer.email in API is the source of truth for who should receive them.",
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
