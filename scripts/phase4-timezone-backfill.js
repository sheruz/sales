/**
 * Backfill Company.timezone from Google Places lat/lng in metadata.
 * Never overwrites an existing timezone. Never guesses from country alone.
 *
 *   DRY_RUN=1 node scripts/run-with-env.js node scripts/phase4-timezone-backfill.js
 */
const { PrismaClient } = require("@prisma/client");
const { find } = require("geo-tz");
require("./load-env");

const prisma = new PrismaClient();
const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

function isValidIana(tz) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log("Phase 4 timezone backfill" + (DRY_RUN ? " (DRY_RUN)" : ""));
  const companies = await prisma.company.findMany({
    where: { deletedAt: null, timezone: null },
    select: { id: true, name: true, metadata: true },
  });
  let updated = 0;
  let skipped = 0;
  for (const c of companies) {
    const g =
      c.metadata && typeof c.metadata === "object"
        ? c.metadata.google
        : null;
    const lat = g?.lat;
    const lng = g?.lng;
    if (typeof lat !== "number" || typeof lng !== "number") {
      skipped += 1;
      continue;
    }
    let tz = null;
    try {
      tz = find(lat, lng)[0] || null;
    } catch {
      tz = null;
    }
    if (!tz || !isValidIana(tz)) {
      skipped += 1;
      continue;
    }
    console.log(`  ${c.name} → ${tz}`);
    if (!DRY_RUN) {
      await prisma.company.update({
        where: { id: c.id },
        data: { timezone: tz },
      });
    }
    updated += 1;
  }
  console.log(`Done. ${updated} updated, ${skipped} skipped (no lat/lng).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
