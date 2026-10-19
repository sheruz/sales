# Legacy `PlanFeature` usage — remove after B1 verify

B1 pins entitlements on `PlanVersion` / `PlanVersionFeature`. Flat `PlanFeature` (and `DEFAULT_PLANS` Free/Growth/Scale seeds) remain only as a **transition fallback** when `subscription.planVersionId` is null.

After `APPLY=1 node scripts/b1-apply.js`, confirm every active subscription has a `planVersionId`, then delete the sites below.

## Sites to remove

| Location | What |
|---|---|
| `src/services/billing-gateway.service.ts` → `getEffectiveFeature` | Else-branch: reads `sub.plan.features` when `planVersionId` is null. Comment marks `LEGACY FALLBACK — remove after B1 verify`. |
| `src/services/entitlement.service.ts` → `ensureDefaultPlans` / `listPlans` | Bootstraps Free/Growth/Scale via `DEFAULT_PLANS` + `prisma.planFeature.upsert`. `listPlans` still `include: { features: true }` (legacy). Prefer public plans + current `PlanVersion`. |
| `src/lib/billing/entitlements.ts` | `getFeature(features: PlanFeature[], …)` and checks against `sub.plan.features` — pre-version path. Route through billing-gateway / plan version features. |
| `src/components/settings/billing-panel.tsx` | Client `Plan.features` shape from `/api/plans` (legacy `PlanFeature` rows). Switch to versioned limits once API exposes them. |
| `src/lib/billing/phase10.test.ts` | Asserts `DEFAULT_PLANS` Free/Growth/Scale names and prices. Replace with catalog/`b1-plan-catalog` expectations or delete. |

## Related (also legacy; clean up with the above)

- `src/lib/billing/features.ts` — `DEFAULT_PLANS`, `freeFeatures` / `growthFeatures` / `scaleFeatures` (deprecated; B1 seed is `scripts/b1-plan-catalog.js`).
- `src/services/tenant-access.service.ts` — `prisma.planFeature.findMany` when `!sub.planVersionId`.
- `scripts/s25-apply.js` / `scripts/s1-apply.js` — seed/upsert `planFeature` for old keys.

## Verify checklist before delete

1. `node scripts/b1-dry-run.js` — schema ready; Test Tenant → Starter; owner untouched.
2. `APPLY=1 node scripts/b1-apply.js` — all catalog codes seeded; Free/Growth/Scale archived.
3. Query: no non-archived subscription with `plan_version_id IS NULL` (except intentional `UNASSIGNED` / `NONE` locked orgs).
4. Smoke: locked org, Starter module gates, OWNER unlimited.
5. Then remove fallbacks and drop reliance on `plan_features` for runtime.
