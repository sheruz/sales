# Frontend Revenue OS Audit

Status: **AUDIT ONLY — NO IMPLEMENTATION**  
Date: 2026-09-11  
Scope: Align existing frontend with canonical Revenue OS (Phases 1–5).  
Out of scope: Phase 6, Lead retirement, IMAP, second email engine, backend redesign, new fake metrics.

---

## 1. Current frontend map

### Shell

| Piece | Path |
|-------|------|
| Dashboard layout | `src/app/dashboard/layout.tsx` |
| Sidebar | `src/components/dashboard/app-sidebar.tsx` |
| Header | `src/components/dashboard/dashboard-header.tsx` (implied via layout) |
| Brand string | **"Sales Platform"** (not “Revenue OS”) |
| Theme | Light/dark via `next-themes` + shadcn/Tailwind (`src/components/ui/*`) |

### Product feel today

- Canonical CRM surfaces **exist** (Companies, Contacts, Opportunities, Campaigns, Sequences, Inbox).
- Navigation is a **flat Main list** (14 peers) + a secondary “Revenue OS” config group.
- **Leads** and **Autopilot** sit as first-class peers to Opportunities / Sequences.
- Home dashboard is a **KPI + checklist + copilot + analytics card dump**, not a connected revenue control center.
- Entity detail pages exist but **cross-links are incomplete** (dead ends, non-clickable counts, Lead-biased tasks).

---

## 2. Existing routes

### Primary dashboard routes

| Route | Entity / purpose | Detail? |
|-------|------------------|---------|
| `/dashboard` | Home control surface | — |
| `/dashboard/companies` | Company list | `/dashboard/companies/[id]` |
| `/dashboard/contacts` | Contact list | `/dashboard/contacts/[id]` |
| `/dashboard/opportunities` | Opportunity list | `/dashboard/opportunities/[id]` |
| `/dashboard/campaigns` | Campaign list | `/dashboard/campaigns/[id]` |
| `/dashboard/sequences` | Sequence list | `/new`, `/[id]` builder |
| `/dashboard/conversations` | Inbox (canonical) | No dedicated `[id]` URL (in-page selection) |
| `/dashboard/meetings` | Meeting list | No `[id]` page |
| `/dashboard/proposals` | Proposal list | No `[id]` page |
| `/dashboard/pipeline` | Opportunity-stage board (named Pipeline; uses deals API) | Cards → opportunity |
| `/dashboard/leads` | Legacy Lead CRUD | `/new`, `/[id]`, `/[id]/edit` |
| `/dashboard/autopilot` | Legacy lead automation | — |
| `/dashboard/agent` | Revenue Agent | — |
| `/dashboard/tasks` | Tasks (lead-biased links) | — |
| `/dashboard/business-brain` | Business Brain | — |
| `/dashboard/services` | Services / offers | — |
| `/dashboard/icp` | ICP | — |
| `/dashboard/revenue-goals` | Revenue goals | — |
| `/dashboard/sources` | Source connectors | — |
| `/dashboard/settings` | Profile, billing, integrations, team, services tab | — |
| `/dashboard/analytics` | **Redirect → `/dashboard`** | — |
| `/dashboard/assistant` | **Redirect → `/dashboard/agent`** | — |

### Root aliases (redirect into dashboard)

`/business-brain`, `/services`, `/icp`, `/revenue-goals`, `/sources`, `/opportunities`

### Missing first-class routes (desired IA)

| Desired | Current |
|---------|---------|
| `/dashboard/deals` | None — folded into Pipeline + opportunity cards |
| `/dashboard/revenue` | None — KPIs on home + analytics embed |
| `/dashboard/signals` | No list page — signals shown under Company / Opportunity |
| Meeting / Proposal detail | List only |
| Conversation deep-link URL | In-page select only |

**Do not delete existing routes** during alignment; keep backwards compatibility.

---

## 3. Existing APIs (prefer these — do not duplicate)

| Domain | Primary APIs / services |
|--------|-------------------------|
| Companies | `companyService` / `/api/companies` |
| Contacts | `contactService` / `/api/contacts` |
| Opportunities | `opportunityService` / `/api/opportunities` |
| Campaigns | `campaignService` / `/api/campaigns`, enrollments, analytics, bridge, bridge-preview, discover |
| Sequences | `outreachSequenceService` / `/api/sequences`, enrollments, analytics |
| Enrollments | `sequenceEnrollmentService` / `/api/enrollments` |
| Inbox | `inboxService` / `/api/conversations`, `/api/inbox/sync` |
| Meetings / Proposals / Tasks | `/api/meetings`, `/api/proposals`, `/api/tasks` |
| Deals | `/api/deals` (board + CRUD) |
| Analytics | `analyticsService.getRevenueDashboard`, `/api/analytics`, `/api/learning` |
| AI recommendations | `/api/ai-recommendations` |
| Business Brain / ICP / Services / Goals / Sources | matching `/api/business-brain`, `/api/icps`, `/api/services`, `/api/revenue-goals`, `/api/source-connectors` |
| Legacy Leads / Autopilot | `/api/leads`, `/api/autopilot`, `/api/automation` |
| Agent | `/api/agent/goals`, `runs`, `approvals` |
| Integrations | `/api/integrations`, `/api/email-accounts` |

**Rule for implementation:** reuse these. Add an API only if a required relationship cannot be fetched from existing endpoints.

---

## 4. Existing components (key)

| Area | Components |
|------|------------|
| Shell | `app-sidebar.tsx`, setup checklist, theme toggle |
| Home | `SetupChecklist`, `DailyRevenueCopilot`, `AnalyticsClient` |
| CRM | `CompaniesList`, `ContactsList`, `OpportunitiesListClient`, `OpportunityDetailClient`, `OpportunityCrmActions` |
| Sequences | `SequenceBuilder`, `SequenceEnrollmentPanel`, `SequenceAnalyticsSummary` |
| Campaigns | `CampaignsList`, `CampaignDetail` (legacy discover), `CampaignCanonicalPanel`, `CampaignAnalyticsPanel`, `CampaignBridgePreviewPanel` |
| Inbox | **`UnifiedInbox`** (wired); `ConversationsInbox` (legacy, unused) |
| Pipeline | `PipelineBoard` |
| Leads | `LeadsList`, `LeadForm`, `LeadDetailTabs`, `LeadAIPanel` |
| Autopilot / Agent | `AutopilotPanel`, `AgentConsoleClient` |
| Revenue OS config | `BusinessBrainClient`, `IcpPageClient`, `ServicesPageClient`, `RevenueGoalsClient`, `SourcesPageClient` |
| UI primitives | `src/components/ui/*` (Card, Button, Badge, Sidebar, Tabs, Dialog, Skeleton, Sonner) |

---

## 5. Canonical entities (frontend representation)

| Entity | UI status | Primary data |
|--------|-----------|--------------|
| Business Brain | Page exists | Real APIs |
| Revenue Goals | Page + dashboard KPI | Real |
| ICP | Page exists | Real |
| Services / Offers | Page + Settings tab | Real (duplicate surfaces) |
| Sources / Connectors | Page exists | Real |
| Signals | Embedded on Company/Opportunity only | Real |
| Company | List + detail | Real, org-scoped |
| Contact | List + detail + enrollments | Real |
| Opportunity | List + rich detail + CRM actions | Real |
| Campaign | List + hybrid detail (canonical + legacy) | Real |
| Sequence | List + builder + analytics | Real |
| SequenceEnrollment | Panels on Contact/Opportunity/Campaign/Sequence | Real |
| Conversation (Inbox) | UnifiedInbox | Real OAuth sync + outbound via inbox send |
| Meeting | List only | Real |
| Proposal | List only | Real |
| Deal | No dedicated page; pipeline/opp cards | Real via `/api/deals` |
| Revenue | Dashboard KPIs / analytics | Real `analyticsService` |
| Analytics / Learning | Embedded on home | Real |
| Revenue Agent | Agent console | Real |

---

## 6. Legacy entities (must stay, must look secondary)

| Entity | UI status | Notes |
|--------|-----------|-------|
| Lead | Full CRUD + AI panels; **prominent in Main nav** | Compatibility path; company often free-text |
| CampaignLead | Campaign detail “Legacy Campaign Leads” + bridge | Phase 4 bridge/preview present |
| FollowUpJob | Backend only; surfaced via legacy campaign stats | Not a first-class page |
| Autopilot | Main nav peer | Creates/automates **Leads**; legacy |
| Legacy Conversation | `ConversationsInbox` component unused | Prefer UnifiedInbox |

---

## 7. Missing relationships (cross-link gaps)

| From | Missing / weak |
|------|----------------|
| Company | Deals/conversations often counts only — not navigable; no Campaigns tab; limited Activity timeline |
| Contact | Conversations/meetings weak deep-links; company link exists |
| Opportunity | Stronger than most; still can improve Campaign → Sequence → Enrollment → Reply narrative |
| Campaign | Conversations/Meetings/Deals not as first-class related sections; analytics present |
| Sequence | “Campaigns using this sequence” not a clear related list |
| Conversation | Context chips incomplete vs desired Company/Contact/Opportunity/Campaign/Sequence |
| Meeting / Proposal | No detail hub; limited back-links beyond opportunity |
| Deal | No detail route → Company/Contact/Opportunity/Revenue |
| Revenue | Weak attribution UI (“which campaign/source?”) — must stay honest if data missing |
| Tasks | Links lean **Lead**, not Opportunity/Contact |
| Dashboard | No clickable pipeline strip Companies→…→Revenue; no activity feed of real events |

---

## 8. Duplicate UI

| Overlap | Issue |
|---------|--------|
| Pipeline vs Opportunities | Two opportunity workspaces (board vs list) |
| Pipeline vs Deals | Named Pipeline; API is deals board; no Deals nav item |
| Leads vs Companies/Contacts/Opportunities | Dual CRM in Main nav |
| Campaign legacy discover vs Sequences | Both on campaign page |
| UnifiedInbox vs ConversationsInbox | Dead legacy component |
| Services page vs Settings→Services | Duplicate config |
| Analytics vs Dashboard | Analytics redirected into home card dump |
| Autopilot vs Agent vs Campaign discover | Three automation entry points |

---

## 9. Permission mismatches

| Issue | Detail |
|-------|--------|
| Nav vs page gates | Nav uses org `anyOf`; many pages only check `organizationId` (opportunities list, inbox, meetings, proposals, brain/ICP/services/goals/sources). |
| Autopilot | Nav: `campaigns.manage` \| `agent.manage`; page historically uses legacy `ai:use` style gates — **parity risk**. |
| Campaigns | Generally good: `campaigns.view` / `campaigns.manage` on list/detail; enroll/bridge correctly split. |
| Sequences | Builder `canManage` mirrors `sequences.manage`; view-only path exists. |
| Settings | Mix of legacy role `settings:read` and org perms — keep but do not invent new keys. |

**Rule:** Frontend visibility never authorizes; mirror backend; no new permission keys.

---

## 10. Empty-state problems

| Pattern today | Problem |
|---------------|---------|
| Bare `0` / `$0` KPI cards | Looks unfinished when setup incomplete |
| “No X yet” without CTA | Dead end |
| SetupChecklist | Good — hidden at 100%; underused as system narrative |
| Copilot silent empty on error | Should be honest empty, not blank |

Need distinct states: **Not configured** / **Not connected** / **No data yet** / **No activity** + CTAs.

---

## 11. Navigation problems

1. Flat Main nav → feels like 15 CRUD modules, not one Revenue OS.
2. Leads above/beside Campaigns/Sequences in importance.
3. Autopilot not labeled Legacy.
4. Intelligence config (Brain/ICP/Services/Goals/Sources) is secondary group — good start, wrong order vs recommended (should lead setup story).
5. No Signals nav (acceptable if Signals stay embedded — document as intentional).
6. No Deals / Revenue nav items.
7. Brand “Sales Platform” undercuts Revenue OS messaging.

---

## 12. Recommended changes (frontend-only, after approval)

### A. Sidebar IA (routes preserved)

Proposed groups:

1. **REVENUE** — Dashboard  
2. **PIPELINE** — Companies, Contacts, Opportunities, Campaigns, Sequences, Inbox, Meetings, Proposals, Deals *(Pipeline board can rename or nest under Opportunities/Deals)*, Revenue *(or keep analytics on Dashboard)*  
3. **INTELLIGENCE** — Business Brain, ICP, Services, Revenue Goals, Sources *(Signals embedded or later)*  
4. **AUTOMATION** — Revenue Agent; Autopilot **(Legacy)**  
5. **LEGACY / COMPATIBILITY** — Leads  

Preserve all `anyOf` permission keys; only regroup/relabel.

### B. Dashboard → Revenue OS control center

Rebuild presentation using **existing** `analyticsService`, readiness, recommendations:

- Header + attention summary  
- Revenue snapshot (only real metrics; extend with enrollments/replies/meetings **if already available from existing services** — otherwise omit)  
- Clickable pipeline strip  
- Recent activity feed (real events only)  
- Action center from readiness gaps  
- Contextual copilot (real org data / honest empty)

No fake numbers.

### C. Entity detail consistency

Add shared pattern (header + related sections/tabs) for Company, Contact, Opportunity, Campaign, Sequence, Conversation context — **without** backend redesign.

### D. Cross-links

Make counts clickable; add “View X” actions; conversation context chips; deal/revenue honesty (“Attribution unavailable”).

### E. Canonical vs Legacy visual language

Badge/label **Legacy** on Leads, Autopilot, CampaignLead sections; keep bridge/preview.

### F. Empty states

Replace bare zeros for setup gaps with explained CTAs.

### G. Explicitly do NOT change

- Tenant isolation, RBAC catalog, executor, email safety, duplicate-send, bridge, inbound sync, snapshots, analytics calculations, migrations  
- Sequence Builder execution lifecycle rules  
- Canonical send path (`inboxService.sendOutreach`)

---

## 13. Files that will be modified (when approved)

### High confidence (IA / presentation)

| File | Change |
|------|--------|
| `src/components/dashboard/app-sidebar.tsx` | Grouped nav + Legacy labels |
| `src/app/dashboard/page.tsx` | Revenue OS control center layout |
| `src/components/dashboard/setup-checklist.tsx` | Possibly align action center / guided steps |
| `src/components/dashboard/daily-revenue-copilot.tsx` | Contextual / honest empty |
| `src/components/dashboard/analytics-client.tsx` | Placement/hierarchy only if needed |

### Entity relationship UX

| File | Change |
|------|--------|
| `src/app/dashboard/companies/[id]/page.tsx` | Related sections + links |
| `src/app/dashboard/contacts/[id]/page.tsx` | Related sections + links |
| `src/app/dashboard/opportunities/[id]/page.tsx` | Timeline/related polish (real events) |
| `src/app/dashboard/campaigns/[id]/page.tsx` | Canonical vs Legacy section hierarchy (keep panels) |
| `src/app/dashboard/sequences/[id]/page.tsx` | Related campaigns/enrollments presentation |
| `src/components/conversations/unified-inbox.tsx` (or equiv.) | Relationship context chips |
| `src/app/dashboard/meetings/page.tsx` | Empty states + links |
| `src/app/dashboard/proposals/page.tsx` | Empty states + links |
| `src/app/dashboard/pipeline/page.tsx` | Naming/copy alignment with Opportunities/Deals |
| `src/app/dashboard/leads/page.tsx` (+ detail) | Legacy labeling |
| `src/app/dashboard/autopilot/page.tsx` | Legacy labeling |

### Possible small shared helpers (new, UI-only)

| File | Purpose |
|------|---------|
| `src/components/crm/entity-related-links.tsx` (or similar) | Reusable related-entity link strip |
| `src/components/crm/empty-state.tsx` | Configured / connected / no-data CTAs |
| `src/components/crm/legacy-badge.tsx` | Consistent Legacy badge |

### Unlikely / avoid unless required

- New API routes  
- Backend services  
- Prisma / migrate scripts  
- Sequence executor / inbox send / analytics math

### Verification after implementation

```bash
npm run typecheck
npm test
npm run build
# lint touched frontend files only
```

No production migrations. No Phase 6.

---

## Page-by-page audit summary

| Page | API / service | Canonical? | Links | Perms | Fake data? | Empty/load | Org scoped |
|------|---------------|------------|-------|-------|------------|------------|------------|
| Dashboard | analytics + readiness + AI recs | Mixed hub | Partial | Mixed | No | Weak zeros | Yes |
| Companies | companyService | Yes | Partial | view gates | No | Basic | Yes |
| Contacts | contactService + enrollments | Yes | Partial | view gates | No | Basic | Yes |
| Opportunities | opportunityService | Yes | Stronger | Nav yes; page weak | No | Basic | Yes |
| Pipeline | `/api/deals?board=1` | Yes (misnamed) | → opp | Nav yes | No | Loading | Yes |
| Campaigns | campaign* APIs | Hybrid | Sequences/bridge | view/manage | No | Analytics OK | Yes |
| Sequences | sequence* APIs | Yes | Enrollments | view/manage | No | OK | Yes |
| Inbox | inboxService | Yes | Partial | Nav yes; page weak | No | Client states | Yes |
| Meetings | meetingService | Yes | → opp | Weak page | No | CTA weak | Yes |
| Proposals | proposalService | Yes | → opp | Weak page | No | CTA weak | Yes |
| Deals | API only | Yes | Missing UI | — | — | — | Yes |
| Revenue | home KPIs | Yes | Weak | analytics.view | No | Zeros | Yes |
| Business Brain / ICP / Services / Goals / Sources | matching APIs | Intelligence | Weak guided flow | Nav stronger than page | No | Varies | Yes |
| Leads | leadService | **Legacy** | Weak to Company | leads.view | No | Standard | Yes |
| Autopilot | autopilot API | **Legacy** | Lead path | Mismatch risk | No | — | Yes |
| Agent | agent APIs | Automation | Goals | agent.* | No | — | Yes |
| Tasks | taskService | Hybrid | Lead-biased | Mixed | No | — | Yes |
| Settings | integrations etc. | Config | Services dup | Mixed legacy | No | — | Yes |

---

## Implementation priority (suggested, pending approval)

1. **Sidebar regroup + Legacy labels** (highest clarity, lowest risk)  
2. **Dashboard control center** (real metrics only)  
3. **Company / Contact / Opportunity / Campaign / Sequence related links**  
4. **Inbox relationship context**  
5. **Empty-state system**  
6. **Pipeline/Deals naming + optional Deals entry** (route-compatible)  
7. **Guided Intelligence setup ordering** (reuse SetupChecklist)

---

## STOP

Audit complete. **No frontend implementation started.**  
Awaiting approval of recommended changes before any code edits.
