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

## After apply — verify
1. Overview MRR matches Revenue Live for same env.
2. Zoiax (and other) transactions show non-zero amounts.
3. Failed/unmatched count drops (skipped separate).
4. Cannot deactivate Super Admin / self / primary admin.
5. Enroll 2FA; next login requires code.

## Next slice
B4b after you verify B4a.
