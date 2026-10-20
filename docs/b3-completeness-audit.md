# B1–B3.1 Completeness Audit (2026-10-20)

Statuses: **DONE** | **PARTIAL** | **MISSING**.  
Out of scope this round: Phase 6 · Stripe Live · Paddle Live · B5 full email polish.

---

## Spec §1 — Super Admin creates companies (B1)

| Requirement | Status | Reference |
|---|---|---|
| New company fields (name, slug, country, tz, currency, owner, access option, notes) | DONE | `organization.service.ts` `createCompanyTenant` |
| Org status INVITED → ACTIVE → ARCHIVED | DONE | `OrganizationStatus`, invite accept |
| Owner invite email 72h, resend/copy/cancel | DONE | invite flow + platform UI |
| Audit log on create | DONE | platform audit |
| `billingEmail` = owner email at creation | DONE | `createCompanyTenant` + b3-2 backfill |

## Spec §2 — Subscription states

| Requirement | Status | Reference |
|---|---|---|
| NONE / TRIALING / ACTIVE / PAST_DUE / SUSPENDED / CANCELED / EXPIRED | DONE | `SubscriptionStatus`, gateway |
| Grace → SUSPENDED, inbound kept | DONE | lifecycle + jobs |
| Locked experience for NONE/EXPIRED | DONE | `tenant-access`, choose-plan |

## Spec §3 — Locked / Choose Plan

| Requirement | Status | Reference |
|---|---|---|
| Redirect + API 403 + jobs skip | DONE | 4-layer gating |
| Choose Plan UI (toggle, cards, comparison) | DONE | `choose-plan-client.tsx` |
| Non-admin locked message | DONE | tenant-access |

## Spec §4 — Checkout & activation

| Requirement | Status | Reference |
|---|---|---|
| Provider checkout + org customer once | DONE | `paddle.provider` createCustomer + isolation |
| Activating poll until webhook | DONE | `/billing/activating` |
| Credits grant idempotent | DONE | `paddle_tx:` keys |
| Welcome email to tenant | DONE | `billingNotifyService.emailTenantBilling` |
| Onboarding wizard / checklist | PARTIAL | checklist exists; full wizard B5 |
| Resync from provider on tenant | DONE | tenant Billing tab `resync_paddle` |

## Spec §5–5b — Packages (B2)

| Requirement | Status | Reference |
|---|---|---|
| Dynamic plans / versions / apply modes | DONE | packages UI + publish |
| Preview / pause on limit drop | DONE | plan-pause |
| Publish syncs provider products | DONE | multi-provider registry |
| Credit prices / top-ups / overrides | DONE | platform pages |

## Spec §6 — Module gating

| Requirement | Status | Reference |
|---|---|---|
| Feature keys + 4 layers | DONE | features/modules + gateway |

## Spec §7 — Plan changes / payment problems

| Requirement | Status | Reference |
|---|---|---|
| Upgrade / downgrade / cancel / resume / portal | DONE | subscription + paddle routes |
| PAST_DUE emails day 0/3/6 | PARTIAL | day 0 exists; 3/6 via lifecycle (verify) |
| Refund/chargeback → SA alert | DONE | `billingNotifyService.notifySellers` |
| Monthly renewal credits | DONE | webhook renewal_paid |

## Spec §8 — Super Admin console (B4 pulled forward)

| Requirement | Status | Reference |
|---|---|---|
| Overview MRR + counts + failed | DONE | overview cards → revenue/transactions |
| Revenue dashboard LIVE vs Test | DONE | `/platform/revenue` |
| Transactions page + CSV | DONE | `/platform/transactions` |
| Invoices all orgs | DONE | `/platform/invoices` |
| Tenant Billing tab (ids, txns, actions) | DONE | `TenantBillingTab` |
| Tenants list MRR columns | PARTIAL | basic list |
| Payments settings | DONE | B3.1 Payments UI |
| Audit log UI | DONE | `/platform/audit` |

## Spec §9 — Platform emails

| Requirement | Status | Reference |
|---|---|---|
| System sender to billingEmail (+ admins) | DONE | `billing-notify.service` |
| Delvix-branded platform mail | PARTIAL | SMTP from; templates sparse (B5) |
| Seller alerts to SA emails | DONE | PaymentSettings.sellerAdminEmails + in-app |

## Spec §10 — Payment provider (B3 / B3.1)

| Requirement | Status | Reference |
|---|---|---|
| Adapter interface | DONE | provider-types |
| Paddle sandbox checkout + webhooks | DONE | paddle.provider, webhook-processor |
| Stripe adapter (test) | DONE | stripe.provider (live out of scope) |
| Manual Payoneer/Bank | DONE | manual.provider + invoices |
| Webhooks store-first, retry, unmatched | DONE | BillingWebhookEvent + Payments UI |
| SA PaymentProviderConfig encrypted | DONE | payment-config.service |
| Emergency kill switch | DONE | PAYMENTS_EMERGENCY_DISABLE |
| One Paddle customer / org / env | DONE | createCustomer clash guard + apply clear |
| Tenant billing contact details → Paddle | DONE | `/api/billing/contact` + syncCustomerDetails |

## Tenant isolation (QA finding C)

| Requirement | Status | Reference |
|---|---|---|
| Email branding scoped by orgId | DONE | email-branding.service |
| No Delvix fallback in send branding | DONE | branding.ts + email-branding.service |
| DEFAULT branding not Delvix URLs | DONE | `DEFAULT_EMAIL_BRANDING` blank |
| Outbound refuse without compliance footer | DONE | enroll + `sendOutboxItem` held |
| Integrations/keys no owner fallback for tenants | DONE | `platform-keys.ts` OWNER-only |
| New org blank checklist | DONE | billingEmail seeded; branding blank |
| Tests isolation | DONE | `b3-2-isolation.test.ts` |

## GO messages B1 / B2 / B3 / B3.1 (delta)

| Item | Status |
|---|---|
| B1 scripts dry-run/apply + tests locked/OWNER | DONE |
| B2 packages editor + sync | DONE |
| B3 Paddle+manual, PAYMENTS_ENABLED, ProviderPriceMap, Stripe 410, sandbox guide | DONE |
| B3.1 SA PaymentProviderConfig/Settings, kill, Stripe adapter, multi sync, Choose Plan methods | DONE |
| B3 QA: billing email / Paddle customer | DONE (await apply) |
| B3 QA: branding isolation | DONE |
| B3 QA: SA revenue/transactions/tenant billing | DONE (await apply) |
| Phase 6 | out of scope |

## Beenish Paddle customer (investigation)

Local DB has no Beenish user (prod-only). After apply, run on server:

```bash
node scripts/b3-2-inspect-paddle-customer.js --email=beenishshahid514@gmail.com
```

Likely causes: (1) org `billingEmail` null → checkout used wrong fallback; (2) sandbox Paddle forwards non-domain receipts to seller email `info@delvixstudio.com`; (3) existing `paddleCustomerId` created with seller email and never PATCHed. Fix ensures customer email = `Organization.billingEmail` and updates Paddle on change.
