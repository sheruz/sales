# B4b Runbook — IA / Dashboard

## What shipped
- Sidebar groups: Dashboard · Customers · Billing · System (Revenue + Activity removed)
- `/platform/revenue` → redirect to Dashboard
- `/platform/activity` → redirect to Dashboard `#activity`
- Header Live | Test switch (cookie `platform_billing_env`)
- Test amber banner when sandbox selected
- Dashboard uses env cookie for MRR/ARR/chart/plan mix + activity snapshot
- Transactions default to cookie env (`?environment=all` for both)
- Org search from header → `/platform/companies?q=`
- Formatters: `lib/platform/format.ts`, status badges, recharts chart

## Deploy
```bash
cd /var/www/html/sales
git pull
npm install   # recharts
npm run build
pm2 restart sales
```

## Verify
1. Sidebar has 4 groups; no Revenue / Activity items.
2. Toggle **Test** → amber banner; Overview MRR switches to sandbox.
3. Toggle **Live** → banner gone; Live MRR again.
4. `/platform/revenue` lands on Overview.
5. Chart renders (empty state OK if no txns).
6. Header search finds an org by name.
7. Transactions list respects header env unless filter overridden.

## Next
B4c page polish after GO.
