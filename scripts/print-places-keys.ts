import prisma from "../src/lib/db/prisma";
import { decryptCredentials } from "../src/lib/integrations/credentials";

function readKey(payload: string | null): string {
  if (!payload) return "(none)";
  try {
    return decryptCredentials(payload).apiKey || "(empty)";
  } catch {
    return "(could not decrypt)";
  }
}

async function main() {
  const tenants = await prisma.tenantIntegration.findMany({
    where: { providerId: "google_places" },
    include: { organization: { select: { name: true, slug: true } } },
  });

  for (const row of tenants) {
    console.log(
      [
        row.organization.name,
        row.organization.slug,
        row.status,
        readKey(row.encryptedCredentials),
      ].join(" | ")
    );
  }

  const legacy = await prisma.userIntegration.findMany({
    where: { platform: "GOOGLE_PLACES" },
    include: { organization: { select: { name: true, slug: true } } },
  });

  for (const row of legacy) {
    console.log(
      [
        "legacy",
        row.organization.name,
        row.organization.slug,
        String(row.isConnected),
        readKey(row.encryptedCredentials),
      ].join(" | ")
    );
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
