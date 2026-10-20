# B3.2 Runbook — billing email isolation, branding, SA revenue

## Preflight
1. Backup Postgres.
2. On server: `node scripts/b3-2-dry-run.js` — confirm planned columns/tables.
3. Inspect Beenish (after deploy or with prod DB + Paddle key):
   `node scripts/b3-2-inspect-paddle-customer.js --email=beenishshahid514@gmail.com`

## Apply (after GO)
```bash
APPLY=1 node scripts/b3-2-apply.js
npx prisma generate
npm run build
pm2 restart sales
```

## Post-verify
- `node scripts/b3-2-dry-run.js` → schema.ready true, no shared Paddle customers.
- Beenish: Plan & Billing → billing email = beenish…; open Tenant Billing tab → Paddle customer email matches (or PATCH by saving contact).
- New company: billingEmail = owner; blank branding; outbound held without address.
- SA: Revenue / Transactions / Invoices nav; Payments → seller alert emails.

## Out of scope
Phase 6 · Stripe Live · Paddle Live
