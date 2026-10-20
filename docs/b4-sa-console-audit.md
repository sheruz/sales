# B4 Super Admin console — audit (await GO)

No Phase 6. Implement only after GO.

---

## Root causes (Part 1 data bugs)

| Bug | Cause | Fix plan |
|---|---|---|
| Overview MRR $98 / 3 active vs Revenue Live $0 / Test $49 | Overview mixes all envs + ACTIVE-only from plan prices; Revenue splits env; txn-based month revenue is $0 | One `platformMetricsService` / harden `revenueMetricsService`; env switch; MRR = ACTIVE+PAST_DUE monthly-eq; exclude OWNER org, OWNER/COMPLIMENTARY plans, unpaid manual |
| Zoiax txn USD 0.00 | Webhooks hardcode `amount: 0`; Paddle totals never mapped | Parse Paddle minor units → store amount/tax/fee/net; backfill from `BillingWebhookEvent.payload` |
| Failed/unmatched: 68 | Count = `error` + `unmatched`; no `skipped` for ignored types; owner/older events may be mislabeled | Classify ignored → `skipped`; recount; dry-run cleanup script |
| Integration counts wrong | Overview uses `UserIntegration.isConnected` only | Single helper: `TenantIntegration.status === CONNECTED` |
| Archived Free has 1 sub | Legacy Free still linked | Report org; migrate script propose → Starter/NONE |
| Internal Owner PUBLIC | UI allows PUBLIC; no server guard | Enforce INTERNAL for OWNER/COMPLIMENTARY; fix row; hide legacy from Public tab |

---

## Part 1 — files to change

### Metrics (single source)
| File | Change |
|---|---|
| `src/services/billing/revenue-metrics.service.ts` | Rename/extend → **canonical** MRR/ARR/revenue/counts; env param; exclude OWNER org + plan codes OWNER/COMPLIMENTARY + manual unpaid; include PAST_DUE in MRR; MoM delta |
| `src/lib/billing/platform-metrics.ts` (new) | Shared types + `isMrrEligibleSubscription()` |
| `src/app/platform/page.tsx` | Delete local MRR query; use service + env |
| `src/app/platform/revenue/page.tsx` | **Remove** (redirect → dashboard) |
| `src/app/api/platform/revenue/route.ts` | Point at same service; respect `?environment=` |
| `src/lib/billing/b4-metrics.test.ts` (new) | Unit tests for eligibility + yearly/12 |

### Transaction amounts
| File | Change |
|---|---|
| `src/services/billing/provider-types.ts` | Add amount/tax/fee/net/currency on mapped money events |
| `src/services/billing/paddle.provider.ts` | Parse `details.totals` (minor units → major) |
| `src/services/billing/stripe.provider.ts` | Parse invoice/charge amounts when present |
| `src/services/billing/webhook-processor.service.ts` | Pass real amounts into `billingTransactionService.record`; record renewals |
| `src/services/billing/billing-transaction.service.ts` | Persist tax/fee/net columns if missing (schema) |
| `prisma/schema.prisma` | `BillingTransaction.taxAmount` (if needed); keep fee/net |
| `scripts/b4-backfill-txn-amounts.js` (new) | Dry-run/apply: read webhook payloads → update $0 rows |
| `src/lib/billing/b4-paddle-amounts.test.ts` (new) | Parse fixtures |

### Webhook classification
| File | Change |
|---|---|
| `src/services/billing/webhook-processor.service.ts` | Ignored/unsupported → `skipped` (not error); owner ignore → skipped |
| `scripts/b4-webhook-cleanup-dry-run.js` / `apply.js` | Reclassify incorrect error/unmatched |
| Overview / Payments UI | Count only `error` + `unmatched` (real); show skipped separately |

### Integrations
| File | Change |
|---|---|
| `src/lib/integrations/connected.ts` (new) | `countConnectedByProvider(orgId?)` via TenantIntegration CONNECTED |
| `src/app/platform/page.tsx` (+ health widgets) | Use helper |
| Any other overview/autopilot counters that use UserIntegration for “connected” | Align |

### Plans
| File | Change |
|---|---|
| `src/services/plan-editor.service.ts` | Reject PUBLIC for OWNER/COMPLIMENTARY/internal codes; list filters Public/Internal/Archived |
| `scripts/b4-plans-audit.js` | Report Free subscriber org; fix Internal Owner visibility |
| `src/components/platform/packages-list-client.tsx` | Tabs; hide Unassigned + archived Free/Growth/Scale from Public |
| `src/components/platform/package-editor-client.tsx` | Lock visibility for internal plans |

---

## Part 2 — Safety

| File | Change |
|---|---|
| `src/components/users/user-management.tsx` (+ panel) | Hide delete for self / any SUPER_ADMIN / primary admin; Deactivate dialog + reason; hard-delete separate gated flow |
| `src/services/auth.service.ts` | `deactivateUser` requires reason + audit; `hardDeleteUser` only if no data |
| `src/app/api/users/[id]/route.ts` | PATCH deactivate; DELETE only hard-delete path with flags |
| `prisma/schema.prisma` | `User.totpSecretEnc`, `totpEnabledAt`, `totpRecoveryCodesEnc` (or `UserMfa` table) |
| `src/services/mfa.service.ts` (new) | TOTP setup/verify/recovery; required for SUPER_ADMIN login |
| `src/app/api/auth/mfa/**` (new) | setup, verify, disable, recovery |
| `src/app/platform/settings/page.tsx` | 2FA setup UI |
| Login flow (`auth` / sign-in) | Challenge TOTP when enabled/required |
| Platform UI copy | Strip phase notes (see grep list below) |

### Copy to remove (grep hits)
- `transactions/page.tsx` — “Pass via query string”
- `audit-log-client.tsx` — “full polish in B4”
- `top-up-packs-client.tsx` — “until B3”
- `tenant-lifecycle-actions.tsx` — “B1 lifecycle”
- Re-grep `src/app/platform` + `src/components/platform` after edits

---

## Part 3 — IA / chrome

| File | Change |
|---|---|
| `src/components/platform/platform-sidebar.tsx` | Groups: Dashboard · Customers · Billing · System; drop Revenue + Activity |
| `src/app/platform/revenue/page.tsx` | Redirect → `/platform` |
| `src/app/platform/activity/page.tsx` | Redirect → `/platform` (#activity) |
| `src/components/platform/platform-header.tsx` (new) | Live\|Test switch (cookie/localStorage per admin), Test banner, global search |
| `src/lib/platform/environment-preference.ts` (new) | Read/write preferred billing env |
| `src/app/platform/layout.tsx` | Mount header; pass env context |
| All billing list APIs | Accept `environment=production\|sandbox` |

---

## Part 4 — Pages (rebuild/polish)

| Page | Primary files |
|---|---|
| Dashboard | Rewrite `app/platform/page.tsx` + new widgets/components under `components/platform/dashboard/*`; add **recharts** (no chart lib today) |
| Organizations | `app/platform/companies/page.tsx` + new table client; detail → tabbed `companies/[id]/page.tsx` + Actions menu |
| Users | `users/page.tsx` + management panel (platform admins tab) |
| Packages | list + editor as specified |
| Credit prices | `credit-prices-client.tsx` — friendly labels, one Save + diff confirm |
| Top-ups | dialog create; org picker for grant |
| Transactions | client filters (dropdowns), tax/fee/net cols, empty state |
| Invoices | table + detail drawer actions |
| Payments | move password/reason into per-action confirm dialogs |
| Audit | plain-language actions, expandable diff, pickers |
| Settings | profile, password, 2FA, seller alert emails, system sender, platform name/logo (merge with existing platform email branding) |

Shared UI: `components/platform/ui/*` — page header, status badge map, money/date formatters, confirm dialog, skeletons, empty states.

---

## Part 5 — Design system

- Add formatters: `lib/platform/format.ts` (`$1,234.00`, `20 Oct 2026`)
- Status badge tokens: Active/Trialing/Past due/Suspended/Canceled/Test
- Install `recharts` (+ thin wrapper); verify light/dark
- Consistent max-width + 8px spacing in platform layout
- No new purple/glow aesthetic; match existing shadcn tokens

---

## Scripts / runbook (after GO)

```
backup
node scripts/b4-dry-run.js          # schema + webhook reclass preview + Free sub report + txn $0 count
# GO
APPLY=1 node scripts/b4-apply.js    # columns, plan fixes, webhook reclass, txn amount backfill
npx prisma generate && npm run build && pm2 restart sales
```

---

## Tests (planned)

1. Metrics eligibility (OWNER/COMPLIMENTARY/unpaid manual excluded; PAST_DUE included; yearly/12; env split)
2. Paddle amount parse + backfill idempotency
3. Webhook status classification (ignored → skipped)
4. Delete protections (self / SA / primary admin)
5. TOTP setup + login challenge
6. Env switch filters API results

---

## Out of scope
Phase 6 · Stripe Live · Paddle Live · tenant product UI redesign
