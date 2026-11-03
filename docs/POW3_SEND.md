# PoW3 — Proof-of-Work send + preview

## What shipped

- **Merge vars** — `{{pow_subject_day*}}`, `{{pow_body_day*}}`, `{{preview_url}}`, `{{pow_footer}}`
- **Public preview** — HMAC token at `/api/pow/preview/[token]` (image only; human visits recorded)
- **Approve → enroll** — Proof of Work sequence + day-0 outbox queue (AUTOPILOT source)
- **PLAIN render** — PoW steps never forced through BRANDED cold template
- **Pre-send recheck** — Severity A must still reproduce or outbox holds `pow_stale`
- **Cold enroll skip** — `kind: "pow"` pitches excluded from Enroll-now autopilot

## Enable send (production only after verify)

```bash
# .env on sales host
POW_SEND_ENABLED=true
pm2 restart sales sales-audit-worker
```

Default remains **false**. Queued PoW outbox rows stay `HELD` with `pow_send_disabled` until the flag is on; Process outbox rebuilds them.

## Verify

```bash
npx vitest run src/lib/pow/
POW2_ORG_ID=<uuid> npm run verify:pow2   # still green
node scripts/run-with-env.js npx tsx scripts/pow3-verify.js
```
