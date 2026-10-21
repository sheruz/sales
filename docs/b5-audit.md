# B5 Audit — Lifecycle emails, onboarding, downgrade polish (await GO)

**Date:** 2026-10-21  
**Spec:** `docs/tenant-lifecycle-billing-spec.md` §3, §4 step 5, §7, §9 (+ §11 B5)  
**Out of scope:** Phase 6 · Paddle Live · Stripe Live  

Statuses: **DONE** | **PARTIAL** | **MISSING**

---

## Summary

| # | Area | Status |
|---|---|---|
| 1 | Lifecycle emails + SA template editor + send log | **PARTIAL** emails · **MISSING** editor/log |
| 2 | Onboarding wizard + checklist | **PARTIAL** (checklist orphan; no wizard) |
| 3 | Downgrade / choose-what-stays | **DONE** core · **PARTIAL** email/countdown |
| 4 | Tenant banners | **PARTIAL** |
| 5 | Data export ZIP/CSV | **PARTIAL** (JSON privacy API only) |
| 6 | `docs/backlog.md` (B4c lighter items) | **MISSING** (create on GO) |

**Verdict:** B5 is mostly greenfield on emails/onboarding/export/banners. Choose-what-stays + plan-limit pause already exist and should be polished, not rebuilt.

---

## 1. Platform lifecycle emails

### Spec list vs code

| Template | Status | Evidence |
|---|---|---|
| Invite (set password) | DONE | `organization.service.ts` `sendInviteEmail` → branded platform mail |
| Welcome after activation | DONE | `webhook-processor.service.ts` on `subscription_activated` |
| Trial ending (3d + 1d) | MISSING | No cron/mailer |
| Trial expired | MISSING | Lifecycle expires; no email |
| Payment received / receipt link | PARTIAL | Provider may send; no dedicated platform receipt template |
| Payment failed day 0 | DONE | Webhook + `lastPaymentFailedNoticeDay: 0` |
| Payment failed day 3 / 6 | MISSING | Field never advanced / re-emailed |
| Suspended | MISSING | Status only |
| Reactivated | MISSING | — |
| Cancellation scheduled | MISSING | — |
| Canceled + data export reminder | PARTIAL | Cancel email exists; no export CTA/reminder |
| Downgrade reminder (7 days) | MISSING | Stub in `plan-pause.service.ts` (`emailStubSentAt`) |
| Plan limit notice (pause in 7 days) | PARTIAL | Notice created; email stub only |
| Low credits 20% / 5% / out | PARTIAL | `credit-ledger` → in-app `notificationService`, not branded lifecycle mail |
| Renewal reminder (manual invoices) | MISSING | — |
| Plain-text + support contact | PARTIAL | Platform transactional has text; no support line standard |
| Idempotent sends | PARTIAL | Some webhook paths; no `EmailSendLog` / template idempotency keys |
| Org Audit/Activity visibility | MISSING | No send log UI |

### SA Email templates UI (preview / edit / test / log)

| Capability | Status |
|---|---|
| `/platform/emails` (or Settings → Email templates) | MISSING |
| Editable subject/body + variables | MISSING |
| Preview + test send to self | MISSING |
| Send log (to, template, status) | MISSING |

**Exists today (branding only, not templates):**  
`src/app/platform/settings/page.tsx`, `email-branding-panel.tsx`, `platform-email-branding.service.ts`, `billing-notify.service.ts`, `render-platform-transactional.ts`

### Files to add / change (emails)

| Path | Action |
|---|---|
| `prisma/schema.prisma` | ADD `EmailTemplate`, `EmailSendLog` (+ enums) |
| `src/services/billing/lifecycle-email.service.ts` | NEW — render/send/idempotency |
| `src/services/billing/billing-lifecycle.service.ts` | EXTEND — trial ending/expired, past_due day 3/6, suspend emails |
| `src/services/billing/plan-pause.service.ts` | WIRE real downgrade/limit emails |
| `src/services/billing/credit-ledger.service.ts` (or notify) | WIRE branded low-credit emails |
| `src/services/billing/webhook-processor.service.ts` | Align welcome/cancel/reactivate with templates |
| `src/app/api/cron/automation/route.ts` (or dedicated cron) | TRIGGER cadence jobs |
| `src/app/platform/emails/page.tsx` | NEW — template list |
| `src/components/platform/email-templates-client.tsx` | NEW — edit/preview/test |
| `src/app/api/platform/email-templates/**` | NEW — CRUD + preview + test-send |
| `src/app/api/platform/email-sends/route.ts` | NEW — log list |
| `src/components/platform/tenant-billing-tab.tsx` (or org audit) | SHOW sends for org |
| `scripts/b5-dry-run.js` / `b5-apply.js` / `b5-lib.js` | NEW — schema + seed default templates |
| `src/lib/billing/b5-lifecycle-emails.test.ts` | NEW — idempotency + triggers |

---

## 2. Onboarding wizard (§4 step 5)

| Capability | Status | Evidence |
|---|---|---|
| Redirect activating → wizard | MISSING | `activating` → `appHome()` |
| Steps: profile → services → ICP → integrations → mailbox/DNS → branding → review → shadow Autopilot | MISSING | — |
| ICP niche templates | MISSING | ICP CRUD only |
| Skip / resume / progress saved | MISSING | No `OnboardingProgress` |
| Setup checklist in sidebar | PARTIAL | `setup-checklist.tsx` **exists but unused** |
| Shadow mode Autopilot | PARTIAL | Exists in outbound config; not wizard-gated |

### Files to add / change (onboarding)

| Path | Action |
|---|---|
| `prisma/schema.prisma` | ADD `OnboardingProgress` (orgId, step, skipped, completedAt, data JSON) |
| `src/app/dashboard/onboarding/page.tsx` (+ step clients) | NEW wizard |
| `src/components/dashboard/setup-checklist.tsx` | WIRE into sidebar / layout |
| `src/app/dashboard/billing/activating/page.tsx` | REDIRECT to onboarding when ACTIVE |
| `src/app/api/onboarding/**` | NEW progress GET/PATCH |
| `src/lib/onboarding/icp-templates.ts` | NEW niche templates |
| `src/lib/onboarding/b5-onboarding.test.ts` | NEW skip/resume |

---

## 3. Downgrade / limit-pause UX (§7)

| Capability | Status | Evidence |
|---|---|---|
| Choose what stays page | DONE | `dashboard/billing/choose-what-stays/` |
| APIs + soft pause + apply at deadline | DONE | `plan-pause.service.ts`, `api/billing/plan-limit-notices/**` |
| Banner with deadline | DONE | `plan-limit-notice-banner.tsx` in dashboard layout |
| Live countdown + clearer copy | PARTIAL | Locale string only |
| Emails at open + before deadline | MISSING | Stub only |
| Never pause primary admin | pending verify | Must enforce in choose + apply |

### Files to change (downgrade polish)

| Path | Action |
|---|---|
| `src/app/dashboard/billing/choose-what-stays/choose-what-stays-client.tsx` | POLISH preview/confirm copy |
| `src/components/billing/plan-limit-notice-banner.tsx` | COUNTDOWN + clearer deadline UX |
| `src/services/billing/plan-pause.service.ts` | EMAIL + primary-admin guard tests |
| `src/lib/billing/b5-plan-pause.test.ts` | NEW |

---

## 4. Tenant banners (consistent component)

| Banner | Status |
|---|---|
| Trial ending | PARTIAL (choose-plan local only) |
| Past due (+ Pay / update card) | MISSING |
| Suspended (read-only + Pay) | MISSING |
| Canceled (+ export) | MISSING |
| Low credits | PARTIAL (billing panel badges) |
| Limit notice | DONE |
| Payments in test mode (sandbox sub) | MISSING for tenants |

### Files to add / change (banners)

| Path | Action |
|---|---|
| `src/components/billing/tenant-status-banners.tsx` | NEW shared component |
| `src/app/dashboard/layout.tsx` | MOUNT banners |
| `src/lib/billing/tenant-banner-state.ts` | NEW derive from sub/credits/env |

---

## 5. Data export

| Capability | Status | Evidence |
|---|---|---|
| Org-scoped export API | PARTIAL | `GET /api/privacy/data` → JSON |
| CSV of companies/contacts/opportunities/conversations | MISSING | — |
| ZIP download | MISSING | — |
| Audit-logged | PARTIAL | Soft-delete path; export audit unclear |
| Discoverable UI (canceled / any tenant) | MISSING | — |

### Files to add / change (export)

| Path | Action |
|---|---|
| `src/app/api/privacy/export/route.ts` (or extend data) | ZIP+CSV |
| `src/services/privacy-export.service.ts` | NEW |
| `src/components/settings/data-export-card.tsx` | NEW |
| `src/lib/billing/b5-export.test.ts` | NEW org isolation |

---

## 6. Backlog doc (B4c lighter)

Create on GO: `docs/backlog.md` with:
- Org detail Actions menu redesign  
- Users Platform-admins tab  
- Audit org/actor typeahead  
- Invoices detail drawer (Sheet)  
- Transactions tax column + Select filters  

---

## Schema / scripts (proposed on GO)

```
EmailTemplate (key, subject, bodyHtml, bodyText, variables[], updatedAt)
EmailSendLog (id, organizationId, templateKey, to, status, providerMsgId?, idempotencyKey UNIQUE, createdAt)
OnboardingProgress (organizationId PK, currentStep, completedSteps[], skipped, payload Json, updatedAt)
```

Scripts: `scripts/b5-lib.js`, `b5-dry-run.js`, `b5-apply.js` (idempotent columns/tables + seed default templates).

---

## Tests (planned)

1. Each lifecycle email fires **once** per event (idempotency key).  
2. Preview + test-send API for SA.  
3. Wizard progress save / skip / resume.  
4. Choose-what-stays respects limits; **never pauses primary admin**.  
5. Export only own-org rows.  

---

## Runbook (on GO)

```
backup DB
node scripts/b5-dry-run.js
# your GO
APPLY=1 node scripts/b5-apply.js
npx prisma generate && npm run build
pm2 restart sales
```

---

## Suggested implement slices (after GO)

1. **B5a** — Schema + lifecycle email service + cron cadences + seed templates  
2. **B5b** — SA Email templates UI + send log + org activity  
3. **B5c** — Tenant banners + export ZIP  
4. **B5d** — Onboarding wizard + checklist wire-up  
5. **B5e** — Downgrade polish + backlog.md  

**Awaiting your GO** (full B5 or slice letter).
