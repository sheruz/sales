# B4a Runbook — data correctness + safety

## Dry-run (now)
```bash
node scripts/b4a-dry-run.js
```
Review:
- `zeroAmountTransactions.preview` — old → new amounts
- `webhookAttention` — rows that become `skipped`
- `archivedFreeSubscribers` — which org; **do not migrate until approved**
- `internalPlansWronglyPublic`

## Apply (after your GO)
```bash
# backup DB first
APPLY=1 node scripts/b4a-apply.js
npx prisma generate
npm run build
pm2 restart sales
```

## 2FA break-glass
```bash
node scripts/reset-2fa.js you@example.com
```
Then re-enroll at Platform → Settings → Two-factor authentication.

## Full prod test (from now on)

Run **on the Ubuntu app server** (`/var/www/html/sales`), not local Windows.

### A. Deploy schema + build
```bash
cd /var/www/html/sales
git pull

# B3.2 first (payment_settings.email_branding — fixes Payments spinner)
APPLY=1 node scripts/b3-2-apply.js

# B4a (TOTP cols, txn backfill, webhook skipped, plan visibility)
APPLY=1 node scripts/b4a-apply.js

node scripts/b4a-verify-smoke.js   # expect "ok": true

rm -rf .next
npx prisma generate
npm run build
pm2 restart sales
pm2 logs sales --lines 20          # no email_branding / ViewportBoundary spam
```

### B. Browser (Super Admin)
| # | Where | Pass if |
|---|--------|---------|
| 1 | Platform → **Payments** | Page loads &lt;5s; can open/save settings |
| 2 | Platform → **Overview** | MRR / ARR / active subs are numbers (not blank/error) |
| 3 | Platform → **Revenue** (Live env) | MRR matches Overview for same env |
| 4 | Platform → **Transactions** | Zoiax (or known paid) amount ≠ `$0.00` |
| 5 | Platform → **Webhooks** / Overview webhook widget | Real failures low; **skipped** shown separately |
| 6 | Platform → **Packages** | Internal Owner not on Public tab / not PUBLIC |
| 7 | Platform → **Users** | Deactivate self / Super Admin / primary admin → **blocked** |
| 8 | Platform → **Settings → 2FA** | Enroll; **logout → login** asks for authenticator code |

### C. Optional API/log checks
```bash
# After hitting Payments once:
pm2 logs sales --err --lines 30 | grep -i email_branding || echo "OK: no email_branding errors"

# Locked out of 2FA:
node scripts/reset-2fa.js you@example.com
```

### D. Pass / fail
- **PASS** → all of B1–B8 green, smoke `ok: true`, logs clean → reply **GO B4b**
- **FAIL** → paste `b4a-verify-smoke.js` JSON + `pm2 logs sales --lines 40` + which B# failed

## Next slice
B4b after you verify B4a (PASS above).
