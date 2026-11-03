# PoW5 — Proof of Work billing gate

Deep audit + PoW pitch APIs are gated by the `proof_of_work` module (Pro / Agency). Metered usage still deducts **AUDITS** credits.

## Matrix

| Plan        | `proof_of_work` |
|-------------|-----------------|
| Starter     | off             |
| Growth      | off             |
| Pro         | on              |
| Agency      | on              |
| Owner / Complimentary | on   |

## Wire-up

- Catalog: `scripts/b1-plan-catalog.js` (`MODULE_KEYS` + per-tier features)
- Module: `MODULE_KEYS.PROOF_OF_WORK` in `src/lib/billing/modules.ts` (APIs `/api/pow`, `/api/autopilot/audit/deep`)
- Action: `BILLING_ACTIONS.AUDIT_DEEP` → `featureKey: proof_of_work`, metric `AUDITS`
- Routes: `requireModule(PROOF_OF_WORK)` on deep enqueue + PoW pitch mutations
- Deny UX: `LOCKED` (plan) vs `PAUSED` (out of credits)

## Seed existing plan versions

```bash
DRY_RUN=1 node scripts/run-with-env.js node scripts/pow5-seed-proof-of-work.js
node scripts/run-with-env.js node scripts/pow5-seed-proof-of-work.js
```

New packages via `b1-apply` pick up the catalog automatically.

## Verify

```bash
npm run verify:pow5
```
