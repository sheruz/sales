/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Break-glass: clear Super Admin 2FA so they can re-enroll.
 * Usage: node scripts/reset-2fa.js you@example.com
 * Audit-logged. Server-only.
 */
require("./load-env");
const { ensureDatabaseUrl } = require("./database-url");
ensureDatabaseUrl();
const { createPrisma } = require("./s2-lib");

async function main() {
  const email = process.argv[2];
  if (!email || !email.includes("@")) {
    console.error("Usage: node scripts/reset-2fa.js <email>");
    process.exit(1);
  }
  const prisma = createPrisma();
  try {
    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase().trim(), deletedAt: null },
    });
    if (!user) {
      console.error("User not found");
      process.exit(1);
    }
    await prisma.user.update({
      where: { id: user.id },
      data: {
        totpSecretEnc: null,
        totpEnabledAt: null,
        totpRecoveryCodesEnc: null,
        totpEnrollmentRequired: true,
      },
    });
    await prisma.platformAuditLog.create({
      data: {
        action: "mfa.reset_break_glass",
        targetType: "user",
        targetId: user.id,
        reason: "scripts/reset-2fa.js",
        after: { email: user.email, cleared: true },
      },
    }).catch(() => null);
    console.log(
      JSON.stringify(
        {
          ok: true,
          email: user.email,
          userId: user.id,
          message: "2FA cleared — user must re-enroll at Platform Settings",
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
