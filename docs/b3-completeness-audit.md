# B1–B3.1 Completeness Audit (updated 2026-10-21)

Statuses: **verified (prod)** | **DONE** | **PARTIAL** | **MISSING** | **pending verification**.  
Out of scope: Phase 6 · Stripe Live · Paddle Live · B5 full email polish.

**Legend**
- **verified (prod)** — applied / observed on production after B3.2 / B4a apply + B4 UI deploy
- **pending verification** — code done; sandbox Flows A–H results not recorded

---

## Spec §1 — Super Admin creates companies (B1)

| Requirement | Status | Reference |
|---|---|---|
| New company fields (name, slug, country, tz, currency, owner, access option, notes) | verified (prod) | `organization.service.ts` `createCompanyTenant` |
| Org status INVITED → ACTIVE → ARCHIVED | verified (prod) | `OrganizationStatus`, invite accept |
| Owner invite email 72h, resend/copy/cancel | DONE | invite flow + platform UI (platform-branded) |
| Audit log on create | verified (prod) | platform audit |
| `billingEmail` = owner email at creation | verified (prod) | `createCompanyTenant` + b3-2 apply |

## Spec §2 — Subscription states

| Requirement | Status | Reference |
|---|---|---|
| NONE / TRIALING / ACTIVE / PAST_DUE / SUSPENDED / CANCELED / EXPIRED | verified (prod) | `SubscriptionStatus`, gateway |
| Grace → SUSPENDED, inbound kept | DONE | lifecycle + jobs |
| Locked experience for NONE/EXPIRED | verified (prod) | `tenant-access`, choose-plan |

## Spec §3 — Locked / Choose Plan

| Requirement | Status | Reference |
|---|---|---|
| Redirect + API 403 + jobs skip | verified (prod) | 4-layer gating |
| Choose Plan UI (toggle, cards, comparison) | verified (prod) | `choose-plan-client.tsx` |
| Non-admin locked message | DONE | tenant-access |

## Spec §4 — Checkout & activation

| Requirement | Status | Reference |
|---|---|---|
| Provider checkout + org customer once | verified (prod) | `paddle.provider` createCustomer + isolation |
| Activating poll until webhook | DONE | `/billing/activating` |
| Credits grant idempotent | DONE | `paddle_tx:` keys |
| Welcome email to tenant | DONE | `billingNotifyService.emailTenantBilling` |
| Onboarding wizard / checklist | PARTIAL | checklist exists; full wizard B5 |
| Resync from provider on tenant | DONE | tenant Billing tab `resync_paddle` |

## Spec §5–5b — Packages (B2)

| Requirement | Status | Reference |
|---|---|---|
| Dynamic plans / versions / apply modes | verified (prod) | packages UI + publish |
| Preview / pause on limit drop | DONE | plan-pause |
| Publish syncs provider products | DONE | multi-provider registry |
| Credit prices / top-ups / overrides | verified (prod) | platform pages (B4c polish) |

## Spec §6 — Module gating

| Requirement | Status | Reference |
|---|---|---|
| Feature keys + 4 layers | verified (prod) | features/modules + gateway |

## Spec §7 — Plan changes / payment problems

| Requirement | Status | Reference |
|---|---|---|
| Upgrade / downgrade / cancel / resume / portal | DONE | subscription + paddle routes |
| PAST_DUE emails day 0/3/6 | PARTIAL | day 0 exists; 3/6 via lifecycle (verify) |
| Refund/chargeback → SA alert | DONE | `billingNotifyService.notifySellers` |
| Monthly renewal credits | DONE | webhook renewal_paid |

## Spec §8 — Super Admin console (B4)

| Requirement | Status | Reference |
|---|---|---|
| Overview MRR + counts + failed | verified (prod) | B4a metrics + B4b dashboard |
| Revenue dashboard LIVE vs Test | verified (prod) | Live\|Test header switch (B4b) |
| Transactions page + CSV | verified (prod) | `/platform/transactions` |
| Invoices all orgs | verified (prod) | `/platform/invoices` |
| Tenant Billing tab (ids, txns, actions) | verified (prod) | `TenantBillingTab` |
| Tenants list MRR columns | PARTIAL | basic list |
| Payments settings | verified (prod) | B3.1 + `email_branding` column applied |
| Audit log UI | verified (prod) | `/platform/audit` |

## Spec §9 — Platform emails

| Requirement | Status | Reference |
|---|---|---|
| System sender to billingEmail (+ admins) | verified (prod) | `billing-notify.service` |
| Platform branding from SA settings (not hard-coded) | DONE | `platform-email-branding` + `render-platform-transactional` |
| Seller alerts to SA emails | verified (prod) | PaymentSettings.sellerAdminEmails |

## Spec §10 — Payment provider (B3 / B3.1)

| Requirement | Status | Reference |
|---|---|---|
| Adapter interface | DONE | provider-types |
| Paddle sandbox checkout + webhooks | DONE | paddle.provider, webhook-processor |
| Stripe adapter (test) | DONE | stripe.provider (live out of scope) |
| Manual Payoneer/Bank | DONE | manual.provider + invoices |
| Webhooks store-first, retry, unmatched | verified (prod) | BillingWebhookEvent + skipped (B4a) |
| SA PaymentProviderConfig encrypted | verified (prod) | payment-config.service |
| Emergency kill switch | DONE | PAYMENTS_EMERGENCY_DISABLE |
| One Paddle customer / org / env | verified (prod) | createCustomer clash guard + b3-2 apply |
| Tenant billing contact details → Paddle | DONE | `/api/billing/contact` + syncCustomerDetails |

## Tenant isolation (QA finding C)

| Requirement | Status | Reference |
|---|---|---|
| Email branding scoped by orgId | verified (prod) | email-branding.service |
| No Delvix in tenant outbound templates | DONE | `branded-outbound.template.ts` / `.html` use `{{company_legal_name}}` only |
| No Delvix fallback in send branding | DONE | branding.ts + email-branding.service |
| DEFAULT branding not Delvix URLs | DONE | `DEFAULT_EMAIL_BRANDING` blank |
| Outbound refuse without compliance footer | DONE | enroll + `sendOutboxItem` held |
| Integrations/keys no owner fallback for tenants | DONE | `platform-keys.ts` OWNER-only |
| New org blank checklist | DONE | billingEmail seeded; branding blank |
| Tests isolation | DONE | `b3-2-isolation.test.ts` + `b3-tenant-outbound-isolation.test.ts` |

## GO messages B1 / B2 / B3 / B3.1 / B4 (delta)

| Item | Status |
|---|---|
| B1 scripts dry-run/apply + tests locked/OWNER | verified (prod) |
| B2 packages editor + sync | verified (prod) |
| B3 Paddle+manual, PAYMENTS_ENABLED, ProviderPriceMap, Stripe 410, sandbox guide | DONE |
| B3.1 SA PaymentProviderConfig/Settings, kill, Stripe adapter, multi sync, Choose Plan methods | verified (prod) |
| B3 QA: billing email / Paddle customer | verified (prod) — Beenish user deleted; inspect N/A |
| B3 QA: branding isolation | DONE — Delvix stripped from tenant outbound (2026-10-21) |
| B3 QA: SA revenue/transactions/tenant billing | verified (prod) via B4a/B4b |
| B4a/B4b/B4c SA console | verified (prod) — UI confirmed by SA |
| Phase 6 | out of scope |

## Paddle sandbox Flows A–H

| Item | Status |
|---|---|
| Credits once / redelivery / decline / portal / cancel-resume / past_due / top-up / upgrade-downgrade | pending verification — guide only: `docs/paddle-sandbox-test-guide.md` |

## Beenish Paddle customer

User deleted — inspect returns `user not found`. No further action.
