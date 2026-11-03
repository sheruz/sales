/**
 * PoW6 smoke: preview page URL shape, send-gate env kill, credits.
 *
 *   node scripts/run-with-env.js npx tsx scripts/pow6-verify.js
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
  const { mintPowPreview, previewTtlMsFromEnv, DEFAULT_PREVIEW_TTL_MS } =
    await importMod("../src/lib/pow/preview-token.ts");
  const ttl = previewTtlMsFromEnv();
  if (ttl < 30 * 864e5) {
    fail("ttl", `expected ~60d, got ${ttl}`);
  } else {
    ok("ttl", `${Math.round(ttl / 864e5)}d (default ${DEFAULT_PREVIEW_TTL_MS / 864e5}d)`);
  }

  const page = mintPowPreview({
    organizationId: "00000000-0000-4000-8000-000000000001",
    evidenceId: "00000000-0000-4000-8000-000000000002",
    pitchId: "00000000-0000-4000-8000-000000000003",
    publicSlug: "acme-deadbeef",
    ttlMs: 60_000,
  });
  if (!page.url.includes("/for/acme-deadbeef")) {
    fail("for-url", page.url);
  } else {
    ok("for-url", page.url.slice(0, 64));
  }

  const { CREDIT_ACTIONS, DEFAULT_CREDIT_PRICES } = await importMod(
    "../src/lib/billing/credit-actions.ts"
  );
  const previewPrice = DEFAULT_CREDIT_PRICES.find(
    (p) => p.actionType === CREDIT_ACTIONS.PREVIEW_PAGE
  );
  const deepPrice = DEFAULT_CREDIT_PRICES.find(
    (p) => p.actionType === CREDIT_ACTIONS.AUDIT_DEEP
  );
  if (!previewPrice || previewPrice.byok !== 3) {
    fail("preview-credits", JSON.stringify(previewPrice));
  } else {
    ok("preview-credits", "preview_page=3");
  }
  if (!deepPrice || deepPrice.byok !== 3) {
    fail("deep-credits", JSON.stringify(deepPrice));
  } else {
    ok("deep-credits", "audit_deep=3");
  }

  const { BILLING_ACTIONS, getActionDef } = await importMod(
    "../src/lib/billing/actions.ts"
  );
  const deep = getActionDef(BILLING_ACTIONS.AUDIT_DEEP);
  const prev = getActionDef(BILLING_ACTIONS.PREVIEW_PAGE);
  if (deep?.metric !== "AUDIT_DEEP") fail("deep-metric", deep?.metric);
  else ok("deep-metric", "AUDIT_DEEP");
  if (prev?.metric !== "PREVIEW_PAGE") fail("preview-metric", prev?.metric);
  else ok("preview-metric", "PREVIEW_PAGE");

  // Env unset → sync isPowSendEnabled false (legacy); kill switch path
  delete process.env.POW_SEND_ENABLED;
  const { isPowSendEnabled, assertPowSendAllowed } = await importMod(
    "../src/lib/pow/send-gate.ts"
  );
  if (isPowSendEnabled()) {
    fail("send-sync-unset", "expected false when env unset");
  } else {
    ok("send-sync-unset", "env unset → sync helper false");
  }
  process.env.POW_SEND_ENABLED = "false";
  await expectThrow(
    () => assertPowSendAllowed({ isProofOfWork: true, name: "Proof of Work" }),
    "send-kill-switch"
  );

  console.log(process.exitCode ? "\nPoW6 verify FAILED" : "\nPoW6 verify OK");
}

async function expectThrow(fn, name) {
  try {
    await fn();
    fail(name, "expected throw");
  } catch {
    ok(name, "forced OFF");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
