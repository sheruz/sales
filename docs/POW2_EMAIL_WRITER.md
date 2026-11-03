# PoW2 — Proof-of-Work email writer (drafts only)

## Deploy

```bash
cd /var/www/html/sales
git pull
npm run db:migrate:pow2
npx prisma generate
npm run build
pm2 restart sales sales-audit-worker
```

Keep `POW_SEND_ENABLED=false` (default) until PoW3.

## What shipped

- **Starter offers** + **Case studies** in Business Brain (`/starter-offers`, `/case-studies`)
- **PoW writer** — A/B + High confidence only; validators (words, banned phrases, invented numbers); regenerate once then flag; manual edit re-validates
- **Proof of Work sequence** (Day 0/3/7/14, PLAIN) — `isProofOfWork=true`; executor + outbox refuse send
- **CASL** — Canadian contacts need `emailSource=published` to enroll in PoW (set on contact detail → Email source)
- **Review UI** on company page — finding + 4 drafts; Legacy pitch collapsed
- **`recheckSeverityAFinding`** — ready for PoW3 pre-send

## Verify

```bash
POW2_ORG_ID=<uuid> npm run verify:pow2
npx vitest run src/lib/pow/validators.test.ts
```

## Credits

Uses existing `audit_pitch` action once per generate/regenerate.
