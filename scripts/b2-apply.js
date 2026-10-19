/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * B2 apply: schema SQL + seed default top-up packs.
 * Requires APPLY=1. Never runs payment provider sync.
 */
const fs = require("fs");
const path = require("path");
const {
  DEFAULT_TOP_UP_PACKS,
  createPrisma,
  inspectB2Schema,
  isApply,
} = require("./b2-lib");
const { randomUUID } = require("crypto");

async function runSqlFile(prisma, filePath) {
  const sql = fs.readFileSync(filePath, "utf8");
  // Split on semicolons carefully — DO $$ blocks contain semicolons
  // Execute whole file via pg if available; else statement-ish chunks.
  await prisma.$executeRawUnsafe(sql);
}

async function main() {
  if (!isApply()) {
    console.error("Refusing to apply without APPLY=1");
    console.error("Run: APPLY=1 node scripts/b2-apply.js");
    process.exit(1);
  }

  const prisma = createPrisma();
  const out = {
    phase: "B2",
    mode: "APPLY",
    at: new Date().toISOString(),
    schemaBefore: null,
    schemaAfter: null,
    packsCreated: [],
    notes: [],
    fatal: [],
  };

  try {
    out.schemaBefore = await inspectB2Schema(prisma);
    const sqlPath = path.join(__dirname, "b2-schema.sql");
    if (!out.schemaBefore.ready) {
      out.notes.push(`Applying ${sqlPath}`);
      // Some drivers reject multi-statement; fall back to line-oriented DO blocks
      try {
        await runSqlFile(prisma, sqlPath);
      } catch (err) {
        out.notes.push(
          `Bulk SQL failed (${err.message}); trying statement split`
        );
        const raw = fs.readFileSync(sqlPath, "utf8");
        // Split keeping DO $$ ... $$; blocks intact
        const parts = [];
        let buf = "";
        let inDo = false;
        for (const line of raw.split(/\r?\n/)) {
          if (/^\s*DO\s+\$\$/i.test(line)) inDo = true;
          buf += line + "\n";
          if (inDo && /\$\$;\s*$/.test(line)) {
            parts.push(buf);
            buf = "";
            inDo = false;
          } else if (!inDo && /;\s*$/.test(line) && buf.trim()) {
            parts.push(buf);
            buf = "";
          }
        }
        if (buf.trim()) parts.push(buf);
        for (const part of parts) {
          const stmt = part.trim();
          if (!stmt || stmt.startsWith("--")) continue;
          try {
            await prisma.$executeRawUnsafe(stmt);
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            if (!/already exists|duplicate/i.test(msg)) {
              out.notes.push(`SQL warn: ${msg.slice(0, 200)}`);
            }
          }
        }
      }
    } else {
      out.notes.push("Schema already ready — skipping SQL");
    }

    out.schemaAfter = await inspectB2Schema(prisma);
    if (!out.schemaAfter.ready) {
      out.fatal.push("Schema still not ready after apply");
    } else {
      for (const def of DEFAULT_TOP_UP_PACKS) {
        const existing = await prisma.topUpPack.findFirst({
          where: { credits: def.credits, archivedAt: null },
        });
        if (existing) {
          out.packsCreated.push({
            credits: def.credits,
            action: "skip",
            id: existing.id,
          });
          continue;
        }
        const created = await prisma.topUpPack.create({
          data: {
            id: randomUUID(),
            name: def.name,
            credits: def.credits,
            price: def.price,
            currency: "USD",
            sortOrder: def.sortOrder,
            active: true,
          },
        });
        out.packsCreated.push({
          credits: def.credits,
          action: "created",
          id: created.id,
        });
      }
    }

    out.notes.push("provider sync pending — B3 (stub only)");
  } catch (err) {
    out.fatal.push(err instanceof Error ? err.message : String(err));
  } finally {
    await prisma.$disconnect().catch(() => {});
  }

  console.log(JSON.stringify(out, null, 2));
  if (out.fatal.length) process.exit(1);
}

main();
