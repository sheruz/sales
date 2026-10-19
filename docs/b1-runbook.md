# B1 runbook — Tenant lifecycle & versioned plans

## Before apply

1. Backup Postgres.
2. Deploy/build code with `TENANT_LIFECYCLE_ENFORCED=false` (default).
3. Dry-run:

```bash
cd sales-platform
node scripts/b1-dry-run.js
```

Review every org: current → proposed status/plan/version. Confirm Default Workspace / `PLATFORM_OWNER_ORG_ID` is untouched. Test Tenant → Starter v1.

## Apply (after your GO)

```bash
APPLY=1 node scripts/b1-apply.js
npm run build
pm2 restart sales
```

## Verify lock (staging / Test Tenant)

1. Super Admin → Test Tenant → **Set NONE (lock)** (or leave Starter and skip).
2. Set `TENANT_LIFECYCLE_ENFORCED=true`, rebuild, restart.
3. Login as Test Tenant: modules redirect to Choose Plan; APIs return `403 NO_ACTIVE_SUBSCRIPTION`.
4. Super Admin → Activate manual / trial → modules unlock.
5. Confirm Default Workspace never locks.

## Env flags

| Flag | Default | Meaning |
|------|---------|---------|
| `TENANT_LIFECYCLE_ENFORCED` | false | Lifecycle lock on/off |
| `BILLING_ENFORCEMENT_ENABLED` | false if unset | Credits/limits only |
| `SELF_SIGNUP_ENABLED` | false | Self-serve signup |
| `PLATFORM_OWNER_ORG_ID` | — | Delvix — never locked |
| `BILLING_CONTACT_EMAIL` | — | Choose Plan mailto |

## Legacy PlanFeature

See `docs/b1-legacy-planfeature.md`. Remove fallback after all subs have `planVersionId`.
