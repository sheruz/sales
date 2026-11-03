# PoW6 — Personal preview page, visits, credits, send toggle

Fills gaps vs the original Proof of Work outreach spec (AI mockup + A/B funnel deferred as PoW7).

## What shipped

| Item | Detail |
|------|--------|
| Preview page | `/for/{publicSlug}` — findings, screenshots, starter offer, case study, Reply / Book / Not relevant? Tenant branding only |
| Safety | `robots: noindex,nofollow`; expiry default **60 days** (`POW_PREVIEW_TTL_DAYS`); Not relevant? → suppress contact |
| Visits | Human-only (existing bot filter); visit count + dwell; first human visit → `POW_HOT_LEAD` notify once; **Hot leads** at `/dashboard/hot-leads` |
| Credits | `audit_deep` = 3 (`UsageMetric.AUDIT_DEEP`); `preview_page` = 3 (`UsageMetric.PREVIEW_PAGE`), charged once on page create |
| Send switch | Super Admin global (`Platform Settings`) + per-tenant override (org Actions). `PlatformAuditLog`. Env `POW_SEND_ENABLED=false` **forces OFF** only |

## Not built (by design)

- AI mockup of the fix (old PoW4) → later PoW7a
- A/B experiments + funnel dashboard (old PoW5 product) → later PoW7b  
  (billing gate remains the prior “PoW5” ship)

## Migrate

```bash
DRY_RUN=1 npm run db:migrate:pow6
npm run db:migrate:pow6
npx prisma generate
```

## Verify

```bash
npm run verify:pow6
npx vitest run src/lib/pow/
```
