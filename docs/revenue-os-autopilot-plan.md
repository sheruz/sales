# Revenue OS → Client Autopilot: Build Plan

## Goal
Turn Revenue OS into an autopilot that finds businesses worldwide, emails them, replies with AI, and books Zoom meetings, running 24/7 without me.

Sources: **Google (fully automatic)**, **Meta Lead Ads (inbound, automatic)**, **LinkedIn (AI drafts, I send manually)**.

## Rules for Cursor
- Work **one phase at a time**. Do not start the next phase until I confirm the current one works.
- Before each phase, read the existing code and tell me which files you will change.
- **Never delete database tables or data.** Hide or disable old features behind a feature flag, and migrate data first if needed.
- Every external API must go through an adapter/service file so providers can be swapped.
- Every automatic action must be logged and visible in the UI.
- No scraping LinkedIn. No automated LinkedIn or Meta cold messages (both violate platform rules).

---

## Phase 0: Cleanup (remove the extra stuff) — DONE

Hide legacy Leads / Autopilot / Prospect Finder / Sources scrapers behind flags. Simplify nav. Keep CRM + Campaigns + Sequences + Inbox + Pipeline + Brain/ICP/Goals.

---

## Phase 1: Google business sourcing — DONE (code)

1. `GooglePlacesService` using **Google Places API (New) Text Search**. Settings field for the API key (BYOK encrypted + env fallback).
2. Claude + ICP generate search queries. Review, edit, add, pause in UI before they run.
3. `SearchQuery` table: query text, country, city, status (active/paused/done), last run, results count, pagination token.
4. Create/update **Company**: dedupe by `googlePlaceId` AND normalized website domain. `source = google_places`. Store phone, address, website, city, country. Rating/types in metadata.
5. `CompanyEmail` table for crawled emails (email, source page, type generic/personal).
6. `WebsiteContactCrawler`: homepage + contact/about, max 5 pages, 10s timeout, robots.txt, rate limited. Filter junk emails.
7. Background job: small batches per cron tick (1–2 queries, up to 10 crawls). Daily limits. Skip already-sourced. Sourcing OFF by default.
8. Autopilot → Sourcing UI: ON/OFF, queries, companies today, crawl status, errors, Google spend today/month.
9. Log every API call with cost estimate.

**Done when:** ICP set, turn on (or Run now), real companies with websites and emails appear.

---

## Phase 2: Decision-maker enrichment — DONE (code)

1. `EnrichmentProvider` + `HunterAdapter` (Apollo later). BYOK in Settings.
2. Domain Search → title-priority decision-maker → Email Verifier.
3. Only `valid` enrollable by default; `accept_all` stored as risky. Fall back to crawled `info@` as GENERIC.
4. Contact + Opportunity at stage `SOURCED` (excluded from pipeline board/value/forecast until Phase 4 enrollment → NEW).
5. Domain blocklist, credit limits, Enrich now batch, cron Auto-crawl + Last cron UI.

**Done when:** sourced companies get real decision-maker contacts with verified emails.

---

## Phase 2.5: Product UI alignment — DONE (code)

Autopilot Overview (funnel + checklist + health), company/contact list & detail redesign, shared status badges, `CompanyTimelineEvent` + `timelineService.record()`, bulk crawl/enrich/skip/unskip.

### Terminology
| Term | Meaning |
|------|---------|
| **Company** | Prospect organization (from Places or other sources) |
| **Contact** | Person or general inbox at a company |
| **Opportunity** | Sales journey for a company (starts at **SOURCED**) |
| **Stage / Funnel** | Found → Crawled → Enriched → Audited → Contacted → … → Won |

### Product UI standards (every future phase)
A phase is **not done** unless it ships:
1. Its Autopilot tab (toggle, stats, errors)
2. Funnel stage counts on Overview (or grey “Coming in Phase X”)
3. Timeline events via **`timelineService.record()`** on every automatic action
4. Setup checklist item(s) when a new integration is required
5. Clear empty states explaining what fills the UI and how

---

## Phase 3: Website audit + personalized pitch — DONE (code)

1. `WebsiteAudit` history + separate `Pitch` table (per contact; DRAFT/APPROVED/REJECTED/SUPERSEDED).
2. `WebsiteAuditService`: PageSpeed (mobile then desktop, ~45s timeout) + rule checks + ICP niche checks + Claude pitch JSON grounded in check evidence.
3. Only ENRICHED companies with valid (or allowed risky) contacts. Audit OFF by default; daily limit; Audit now ×3; retry failed max 3; cron batch ≤2–3.
4. Pitch review mode REVIEW_REQUIRED (default) or AUTO_APPROVE. Phase 4 will only send APPROVED.
5. Template vars: flat aliases `{{first_name}}`, `{{company_name}}`, `{{personalized_first_line}}`, `{{top_issue}}`, `{{recommended_service}}`, `{{short_pitch}}`, `{{city}}` + nested backward-compatible; missing vars use fallbacks (never blank/`{{…}}`).
6. Autopilot Audit + Pitch review tabs; company Audit/Pitch cards + email preview; funnel Audited live; timeline AUDITED / AUDIT_FAILED / PITCH_*.

**Done when:** enriched companies get audits + unique first lines; drafts reviewed before Phase 4.

---

## Phase 4: Autopilot outbound email

1. Mailbox pool (SMTP/Gmail/Outlook), daily limits, warmup flag, rotation.
2. Timezone-aware sending (prospect local 8:00–11:00).
3. Auto-enroll verified + audited opportunities into default sequence (stop on reply).
4. Compliance: unsubscribe + address, suppression list.
5. Bounce handling; pause inbox if bounce rate > 3%.

**Done when:** emails go out daily within limits; follow-ups stop on reply.

---

## Phase 5: AI reply agent

1. Classify inbound: interested, question, not_now, not_interested, wrong_person, unsubscribe, out_of_office.
2. Act per class; book-call goal for interested/question.
3. AI Agent Rules settings + guardrails (no invented prices, max 4 AI replies, kill switch).
4. Label “Sent by AI” in Inbox.

**Done when:** replies answered automatically; handoffs notify me.

---

## Phase 6: Zoom meeting booking

1. Google Calendar OAuth + Zoom Server-to-Server.
2. Offer 3 slots in prospect timezone; create Zoom + Calendar + .ics.
3. Meeting record; stage Meeting Booked; reminders; notify me with audit prep.

**Done when:** reply → booked Zoom without me.

---

## Phase 7: Meta Lead Ads (inbound)

1. Meta `leads_retrieval` + Page `leadgen` webhook.
2. Create Contact + Company + Opportunity (`meta_lead_ads`).
3. Welcome email + inbound sequence; audit website if provided.
4. Messenger/IG only inside allowed window (never cold).

**Done when:** ad form submit → email within 5 minutes + booking offer.

---

## Phase 8: LinkedIn assist (manual send)

1. Daily LinkedIn Tasks (15–20) with drafted notes from audit.
2. Open profile / Copy / Mark sent / Mark replied.

**Done when:** ~5 minutes/day of prepared LinkedIn sends.

---

## Phase 9: Autopilot control panel + dashboard

1. Master ON/OFF, per-source toggles, limits, status, errors.
2. KPIs vs $20,000/month target.
3. Daily summary email.

**Done when:** turn on, walk away, check one page.

---

## API keys / accounts needed
- Google Cloud: Places API (New) + PageSpeed Insights
- Enrichment (Hunter or Apollo)
- 3–5 sending inboxes (SPF/DKIM/DMARC, warmed)
- Anthropic (connected)
- Google Calendar OAuth
- Zoom Server-to-Server OAuth
- Meta Business + Lead Ads form + leads permission
