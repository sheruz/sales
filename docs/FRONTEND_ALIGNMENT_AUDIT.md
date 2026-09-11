# FRONTEND REVENUE OS ALIGNMENT AUDIT

Status: Audit complete → Implementation follows (P0–P2).  
Date: 2026-09-11  
Constraints: No Phase 6 · No backend redesign · No Lead retirement · No IMAP · No second email engine · No fake metrics

Full inventory also lives in `docs/FRONTEND_REVENUE_OS_AUDIT.md` (prior pass). This document is the acceptance-format audit + plan.

---

## 1. Current navigation map

**File:** `src/components/dashboard/app-sidebar.tsx`  
**Brand:** “Sales Platform”

| Group | Items (order) |
|-------|----------------|
| Main (flat) | Dashboard, Opportunities, Companies, Contacts, Pipeline, **Leads**, Campaigns, Sequences, Autopilot, Revenue Agent, Inbox, Meetings, Proposals, Tasks |
| Revenue OS | Business Brain, Services, ICP, Revenue Goals, Sources |
| Settings | Settings (`settings:read` legacy role) |

**Problems:** Flat Main; Leads peer to CRM; Autopilot unlabeled legacy; Intelligence below ops; no Deals/Revenue nav; Pipeline naming vs deals API.

---

## 2. Current route map

| Route | Module |
|-------|--------|
| `/dashboard` | Home KPIs + checklist + copilot + analytics |
| `/dashboard/companies` `[id]` | Company |
| `/dashboard/contacts` `[id]` | Contact + enrollments |
| `/dashboard/opportunities` `[id]` | Opportunity hub |
| `/dashboard/pipeline` | Opportunity stage board (`/api/deals?board=1`) |
| `/dashboard/campaigns` `[id]` | Hybrid canonical + legacy |
| `/dashboard/sequences` `new` `[id]` | Builder + analytics |
| `/dashboard/conversations` | UnifiedInbox |
| `/dashboard/meetings` | List only |
| `/dashboard/proposals` | List only |
| `/dashboard/leads` … | Legacy Lead CRUD |
| `/dashboard/autopilot` | Legacy |
| `/dashboard/agent` | Revenue Agent |
| `/dashboard/tasks` | Tasks (lead-biased) |
| `/dashboard/business-brain` `services` `icp` `revenue-goals` `sources` | Intelligence |
| `/dashboard/settings` | Integrations etc. |
| `/dashboard/analytics` | Redirect → home |

**Missing:** `/dashboard/deals`, `/dashboard/revenue`, `/dashboard/signals` list, meeting/proposal/deal detail routes.

---

## 3. Entity relationship map

Desired chain is known. Current UI support:

| Entity | Related UI today | Gap |
|--------|------------------|-----|
| Company | Contacts, Opps, Signals, counts | Deals/conversations often non-clickable |
| Contact | Company, Opps, Enrollments | Weak inbox/meeting deep-links |
| Opportunity | Company, Contact, Campaign, Meetings, Proposals, Deals, Signals | Strongest hub |
| Campaign | Sequence, Enrollments, Legacy leads, Analytics | Conversations/meetings not first-class |
| Sequence | Steps, Enrollments, Analytics | “Campaigns using sequence” weak |
| Inbox | Company/Contact/Opp chips partial | Campaign/Sequence context incomplete |
| Meeting/Proposal | → Opportunity | No detail pages |
| Deal | Opp cards / pipeline | No dedicated page |
| Lead | Isolated legacy | Prominence problem |

---

## 4. Permission map

| Module | Nav gate | Page gate | Notes |
|--------|----------|-----------|-------|
| Campaigns | view\|manage | view\|manage | Good |
| Sequences | view\|manage | Good on builder | — |
| Companies/Contacts | opp.view\|leads.view | Same | OK |
| Opportunities | opp.view | Often orgId only | **P0** |
| Inbox | conversations.view | Often orgId only | **P0** |
| Meetings/Proposals | nav gated | orgId only | **P0** |
| Autopilot | campaigns.manage\|agent.manage | legacy `ai:use` risk | **P0** |
| Brain/ICP/Services | business_brain.manage | orgId only | Align |

Backend remains authoritative; UI must not show rejected controls.

---

## 5. API / UI mismatch list

- Pipeline UI labeled Pipeline but fetches deals board / patches opportunity stages.
- Dashboard “Deals won” links to Pipeline, not a deals surface.
- Tasks list → Lead, while Opportunity creates tasks.
- Services page vs Settings→Services duplicate.
- Analytics route redirects into card dump on home.

---

## 6. Broken / dead links

- Company deal/conversation counts often not navigable.
- Contact conversations without inbox deep-link.
- Unused `ConversationsInbox` legacy component.
- `/dashboard/analytics` redirect (not broken, but IA confusion).

---

## 7. Missing cross-links

Company→Deals/Inbox; Contact→Inbox; Sequence→Campaigns; Enrollment→Conversation; Deal→Revenue; Revenue→Deal attribution honesty.

---

## 8. Duplicate / conflicting concepts

Pipeline vs Opportunities; Pipeline vs Deals; Leads vs CRM; Campaign legacy vs Sequences; Autopilot vs Agent; Services dual surfaces.

---

## 9. Legacy vs canonical UI problems

- Leads mid-Main, unlabeled.
- Autopilot unlabeled.
- Campaign page mixes populations without strong visual separation (improving but still card-noisy).
- CampaignLead counts can be confused with canonical enrollments.

---

## 10. Dashboard problems

Card dump; weak “what next”; no action center; funnel buried in AnalyticsClient; no pipeline strip; copilot often generic; setup vs ops not hierarchical.

---

## 11. Inbox problems

Mostly correct UnifiedInbox; needs stronger Company/Contact/Opportunity/Campaign/Sequence header context; sync honesty already backend-fixed — UI must keep showing warnings.

---

## 12. Campaign problems

Hybrid page; legacy discover still large; need clearer Canonical vs Legacy sections (analytics already dual-path).

---

## 13. Sequence problems

Builder OK; snapshot warning exists on save when open enrollments; archived save rules mostly OK — keep lifecycle guards intact.

---

## 14. Responsive problems

Tables on sequences/campaigns; sidebar icon collapse exists; need intentional mobile stacking on new dashboard sections.

---

## 15. Loading / error / empty-state problems

Bare `0`/`$0`; empty copy without CTA; silent copilot empty; inconsistent skeletons.

---

## 16. Recommended frontend hierarchy

```
WORKSPACE: Dashboard, Inbox, Tasks
CRM: Companies, Contacts, Opportunities (+ Pipeline as board view)
REVENUE: Campaigns, Sequences, Meetings, Proposals, (Pipeline/Deals)
INTELLIGENCE: Sources, Analytics (home section)
CONFIGURATION: Business Brain, ICP, Services, Revenue Goals, Settings/Integrations
AI: Revenue Agent
LEGACY: Leads, Autopilot (Legacy)
```

---

# IMPLEMENTATION PLAN

### P0 — correctness / permission / broken integration
1. Align page-level org permission checks with nav for opportunities, inbox, meetings, proposals, autopilot.
2. Legacy badges on Leads + Autopilot pages/nav.
3. Campaign detail: stronger Canonical vs Legacy visual separation (no metric mixing).

### P1 — canonical entity linking / navigation
1. Regroup sidebar (Workspace / CRM / Revenue / Configuration / AI / Legacy).
2. Brand subtitle → Revenue OS.
3. Company + Contact related link strips (clickable).
4. Inbox conversation context chips (where data already loaded).
5. Shared `LegacyBadge` + `EmptyState` + `EntityRelatedLinks` helpers.

### P2 — dashboard information architecture
1. Header + primary/secondary CTAs from real permissions/data.
2. Setup only when incomplete.
3. Revenue snapshot (existing analyticsService fields only).
4. Clickable flow strip Companies→…→Revenue.
5. Action center from readiness + real counts (inbox needs attention if available without new APIs).
6. Keep AnalyticsClient below fold; no fake metrics.

### P3 — polish (deferred / light only)
Responsive tweaks; reduce card density; copilot CTA polish if time.

---

**Proceeding to implement P0–P2 only.**
