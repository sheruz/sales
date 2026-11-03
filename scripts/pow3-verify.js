/**
 * PoW3 smoke: preview token, merge vars, send gate default off.
 *
 *   node scripts/run-with-env.js npx tsx scripts/pow3-verify.js
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
    ok("send-flag", "POW_SEND_ENABLED=true (production send ON)");
  } else {
    ok("send-flag", "POW_SEND_ENABLED=false (safe default)");
    try {
      assertPowSendAllowed({ isProofOfWork: true });
      fail("send-gate", "expected throw");
    } catch {
      ok("send-gate", "PoW send blocked while flag false");
    }
  }

  const { mintPowPreview, verifyPowPreviewToken } = await importMod(
    "../src/lib/pow/preview-token.ts"
  );
  const minted = mintPowPreview({
    organizationId: "00000000-0000-4000-8000-000000000001",
    evidenceId: "00000000-0000-4000-8000-000000000002",
    pitchId: "00000000-0000-4000-8000-000000000003",
    ttlMs: 60_000,
  });
  const parsed = verifyPowPreviewToken(minted.token);
  if (!parsed?.pitchId || parsed.evidenceId !== "00000000-0000-4000-8000-000000000002") {
    fail("preview-token", "verify failed");
  } else {
    ok("preview-token", `url=${minted.url.slice(0, 48)}…`);
  }

  const {
    buildPowTemplateVars,
    buildPowFooter,
    powRequiredVarsForTemplate,
  } = await importMod("../src/lib/pow/merge-vars.ts");
  const { renderSequenceTemplateDetailed } = await importMod(
    "../src/lib/sequences/runtime.ts"
  );
  const vars = buildPowTemplateVars({
    draft: {
      steps: [
        { day: 0, subject: "issue on site.com", body: "Hi Acme team\n\nBody" },
        { day: 3, subject: "s3", body: "b3" },
        { day: 7, subject: "s7", body: "b7" },
        { day: 14, subject: "s14", body: "b14" },
      ],
    },
    previewUrl: minted.url,
    footer: buildPowFooter({
      senderName: "Alex",
      businessName: "Studio",
      businessAddress: "1 St",
      unsubscribeUrl: "https://example.com/u",
    }),
  });
  const template = `{{pow_body_day0}}\n\n{{preview_url}}\n\n{{pow_footer}}`;
  const rendered = renderSequenceTemplateDetailed(
    template,
    vars,
    powRequiredVarsForTemplate(template)
  );
  if (rendered.missingRequired.length || /\{\{/.test(rendered.text)) {
    fail("merge-vars", JSON.stringify(rendered));
  } else {
    ok("merge-vars", "day0 body + preview + footer resolved");
  }

  console.log("\nManual: approve a PoW draft → enrollment + QUEUED/HELD outbox");
  console.log("  Flip POW_SEND_ENABLED=true only after preview URL opens the screenshot.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
