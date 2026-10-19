/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * B2 dry-run (READ-ONLY). Schema presence + proposed top-up pack seed.
 * Does NOT apply. Wait for GO before: APPLY=1 node scripts/b2-apply.js
 */
const {
  DEFAULT_TOP_UP_PACKS,
  readOnlyPrisma,
  inspectB2Schema,
} = require("./b2-lib");

async function main() {
  const prisma = readOnlyPrisma();
  const out = {
    phase: "B2",
    mode: "DRY_RUN",
    at: new Date().toISOString(),
    schema: null,
    topUpPacksToSeed: [],
    existingTopUpPacks: [],
    notes: [],
    fatal: [],
  };

  try {
    out.schema = await inspectB2Schema(prisma);

    if (!out.schema.ready) {
      out.notes.push(
        "Schema not ready — run scripts/b2-schema.sql then APPLY=1 node scripts/b2-apply.js"
      );
    }

    if (out.schema.tables["top_up_packs"]) {
      const existing = await prisma.$queryRawUnsafe(
        `SELECT id, name, credits, price, currency, active, archived_at FROM top_up_packs ORDER BY sort_order ASC`
      );
      out.existingTopUpPacks = existing;
      for (const def of DEFAULT_TOP_UP_PACKS) {
        const hit = existing.find(
          (p) => Number(p.credits) === def.credits && !p.archived_at
        );
        out.topUpPacksToSeed.push({
          ...def,
          action: hit ? "already exists" : "create",
          existingId: hit?.id ?? null,
        });
      }
    } else {
      out.topUpPacksToSeed = DEFAULT_TOP_UP_PACKS.map((d) => ({
        ...d,
        action: "create after schema",
      }));
    }

    out.notes.push(
      "Provider sync stays stub (MANUAL_PAYONEER / Stripe in B3)."
    );
    out.notes.push(
      "No plan version publish in apply — SA uses Packages UI after deploy."
    );
  } catch (err) {
    out.fatal.push(err instanceof Error ? err.message : String(err));
  } finally {
    await prisma.$disconnect().catch(() => {});
  }

  console.log(JSON.stringify(out, null, 2));
  if (out.fatal.length) process.exit(1);
}

main();
