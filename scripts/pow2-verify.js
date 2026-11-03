/**
 * PoW2 smoke checks (local/dev): send gate off, usable findings, CASL, sequence seed.
 *
 *   POW2_ORG_ID=<uuid> node scripts/run-with-env.js npx tsx scripts/pow2-verify.js
 */
/* eslint-disable @typescript-eslint/no-require-imports */
require("./load-env");

function ok(name, detail) {
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name, detail) {
  console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  process.exitCode = 1;
}

async function importMod(specifier) {
  const mod = await import(specifier);
  if (mod && typeof mod.default && typeof mod.default === "object") {
    return { ...mod.default, ...mod };
  }
  return mod;
}

async function main() {
  const { isPowSendEnabled, assertPowSendAllowed } = await importMod(
    "../src/lib/pow/send-gate.ts"
  );
  if (isPowSendEnabled()) {
    fail("send-gate", "POW_SEND_ENABLED must be false for PoW2");
  } else {
    ok("send-gate", "POW_SEND_ENABLED=false");
  }

  try {
    assertPowSendAllowed({ isProofOfWork: true, name: "Proof of Work" });
    fail("send-gate-assert", "expected throw when send disabled");
  } catch {
    ok("send-gate-assert", "assertPowSendAllowed throws");
  }

  const { pickUsableFindings } = await importMod(
    "../src/lib/pow/usable-findings.ts"
  );
  const usable = pickUsableFindings([
    {
      id: "broken_images",
      severity: "B",
      confidence: "High",
      title: "t",
      whyItMatters: "w",
      evidence: "e",
      observed: true,
      emailEligible: true,
    },
    {
      id: "empty_ctas",
      severity: "C",
      confidence: "High",
      title: "t",
      whyItMatters: "w",
      evidence: "e",
      observed: true,
      emailEligible: false,
    },
    {
      id: "mobile_overlap",
      severity: "A",
      confidence: "Medium",
      title: "t",
      whyItMatters: "w",
      evidence: "e",
      observed: true,
      emailEligible: false,
    },
  ]);
  if (usable.length !== 1 || usable[0].id !== "broken_images") {
    fail("usable-findings", JSON.stringify(usable.map((f) => f.id)));
  } else {
    ok("usable-findings", "A/B+High only");
  }

  const { assertCaslPowEnroll } = await importMod("../src/lib/pow/casl.ts");
  try {
    assertCaslPowEnroll({
      emailSource: "scraped",
      companyCountry: "CA",
    });
    fail("casl-block", "scraped CA should throw");
  } catch {
    ok("casl-block", "scraped CA blocked");
  }
  try {
    assertCaslPowEnroll({
      emailSource: "published",
      companyCountry: "Canada",
    });
    ok("casl-allow", "published CA allowed");
  } catch (e) {
    fail("casl-allow", e instanceof Error ? e.message : String(e));
  }

  const orgId = process.env.POW2_ORG_ID?.trim();
  if (!orgId) {
    console.log("\nSkip DB checks — set POW2_ORG_ID for sequence seed verify");
    return;
  }

  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const org = await prisma.organization.findFirst({
      where: { id: orgId, deletedAt: null },
      select: { id: true },
    });
    if (!org) {
      fail("setup", `org ${orgId} not found`);
      return;
    }
    const { powPitchService } = await importMod(
      "../src/services/pow-pitch.service.ts"
    );
    const seq = await powPitchService.ensureProofOfWorkSequence(orgId);
    if (!seq.isProofOfWork) {
      fail("sequence", "isProofOfWork false");
    } else if (seq.steps?.length !== 4) {
      fail("sequence", `expected 4 steps, got ${seq.steps?.length}`);
    } else if (seq.steps.some((s) => s.emailStyle !== "PLAIN")) {
      fail("sequence", "all steps must be PLAIN");
    } else {
      ok(
        "sequence",
        `Proof of Work seeded with ${seq.steps.length} PLAIN steps`
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
