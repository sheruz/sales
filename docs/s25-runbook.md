# S2.5 Unified Billing Gateway — Linux runbook

## Before apply

1. **Backup** the production database.
2. Deploy/build code that includes S2.5 (or run dry-run from the release branch against prod `DATABASE_URL`).
3. Dry-run (read-only):

```bash
cd /path/to/sales-platform
node scripts/s25-dry-run.js | tee /tmp/s25-dry-run.json
```

Confirm:

- `orgsBecomingEnforced` — expect **Test Tenant** only (today).
- `orgsStayingExempt` includes **Default Workspace** / `PLATFORM_OWNER_ORG_ID`.
- `featureKeysToSeed` lists new keys per plan (`audits`, `crawls`, `emails_daily`, `icps`, `campaigns`, `meetings`).

4. Wait for operator **GO** before apply.

## Apply

```bash
APPLY=1 node scripts/s25-apply.js
npm run build
pm2 restart sales
```

## After apply

Set in production `.env` **explicitly**:

```bash
BILLING_ENFORCEMENT_ENABLED=true
PLATFORM_OWNER_ORG_ID=<default-workspace-uuid>
```

If `BILLING_ENFORCEMENT_ENABLED` is missing, the app logs a startup warning and shows a super-admin banner; enforcement stays off globally.

## Smoke

- Test Tenant: blocked at 0 credits / monthly limit; cold send daily limit → stays QUEUED + rescheduled.
- Default Workspace: unlimited, meters increment, never blocked.
- Plan & Usage: credits + usage by action; OWNER shows Unlimited (not 0 balance).
