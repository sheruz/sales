# Phase 2 — CRM Architecture (Canonical Foundation)

**Date:** 2026-09-04  
**Status:** Implemented (stabilization) — Leads not retired  
**Related:** Phase 1 security (approved)

---

## 1. Current architecture (verified)

Two overlapping CRM stacks share one tenant (`Organization`):

### Revenue OS (canonical path — already in schema)

```text
Business Brain → Services/Offers → ICP → Revenue Goals
       ↓
Source connectors → Signals → Company → Contact?
       ↓
Opportunity (+ intelligence, scores, events)
       ↓
InboxConversation / Messages
       ↓
Meeting → Proposal → Deal → Revenue
```

- **Company** and **Contact** exist and are used by signal ingest (`opportunity.service.ingestNormalizedSignal`).
- **Opportunity** requires `organizationId` + `companyId`; `leadId` / `primaryContactId` / `primarySignalId` are optional.
- **Manual opportunity create** does **not** require a Lead.

### Legacy sales system (still active)

```text
Lead → CampaignLead → Campaign → Autopilot / FollowUpJobs
  ↓
LeadResearch / LeadScore
  ↓
Conversation (legacy lead log)
```

- Campaigns and automation are **lead-centric**.
- Dashboard still has first-class **Leads** pages.
- Hiring/LinkedIn flows often create Lead **and** optionally bridge Opportunity via `leadId`.

### Bridge fields (compatibility)

| Field | Meaning |
|-------|---------|
| `Opportunity.leadId` | Optional 1:1 legacy bridge |
| `Contact.leadId` | Optional 1:1 legacy bridge |
| `Lead.companyId` | Optional link to Company |
| `InboxConversation.leadId` | Optional; also company/contact/opportunity |
| `Deal` / `Meeting` / `Proposal` | May reference lead **and/or** opportunity/company |

### Dual conversations

| Model | Anchor | Role |
|-------|--------|------|
| `Conversation` | **Required** `leadId` | Legacy outreach log (automation) |
| `InboxConversation` + `Message` | Optional company/contact/opp/lead | Canonical inbox |

---

## 2. Canonical architecture (target)

```text
Business Brain
      ↓
Revenue Goal / ICP
      ↓
Sources
      ↓
Signals
      ↓
Company ───── Contact
      ↓
Opportunity
      ↓
Conversation (inbox)
      ↓
Meeting
      ↓
Proposal
      ↓
Deal
      ↓
Revenue
```

### Entity meanings

| Entity | Meaning |
|--------|---------|
| **Company** | Prospect/customer **organization** (Acme, Shopify) — not the SaaS tenant |
| **Contact** | **Person** at a Company (CEO, VP Eng) |
| **Signal** | Buying **event** (hiring, funding, RFP, visitor…) — not a deal |
| **Opportunity** | Qualified **revenue potential**: why this company, why now, what to sell, who to contact, next action |
| **Lead** | **LEGACY** compatibility record for campaigns/automation — not the future CRM center |

### Signal ≠ Opportunity

Example:

- Company: Acme  
- Signal: “Hiring 5 React developers”  
- Opportunity: “Acme likely needs React capacity; fit for our engineering services”

A company may have many signals. Dedup uses org-scoped signal **fingerprint** (+ soft rules). Opportunities are not created 1:1 for every signal when an open opportunity already exists for that company (ingest updates existing).

---

## 3. Lead legacy strategy

```text
LEGACY LEAD
    ↓
Compatibility Bridge (lead-migration.service)
    ↓
Company + Contact (+ optional Opportunity link)
```

**Rules (Phase 2):**

1. Do **not** delete Leads or CampaignLead/automation.
2. Do **not** bulk-migrate all leads automatically.
3. **New revenue features MUST NOT add new Lead dependencies** — prefer Company / Contact / Signal / Opportunity / Inbox.
4. Keep `Opportunity.leadId` / `Contact.leadId` as optional bridges.
5. Bridge service is org-scoped, idempotent, non-destructive, on-demand.

---

## 4–7. Company / Contact / Signal / Opportunity models

### Company

- Scoped by `organizationId`
- Identity: `name`, optional `domain` (unique per org when set), `normalizedDomain` (lowercase domain for stable matching)
- Soft-delete via `deletedAt`
- First-class API + UI as of Phase 2

### Contact

- Belongs to Organization **and** Company
- Optional `leadId` bridge
- `normalizedEmail` for matching (lowercase trim)
- First-class API + UI as of Phase 2

### Signal

- Belongs to Organization + Company
- Fingerprint unique per org
- Created by connectors → normalized record → ingest

### Opportunity

- Belongs to Organization + Company
- Optional primary signal, contact, recommended service/offer
- **Must not require Lead** for creation (manual + ingest without leadId)

---

## 8. Campaign migration strategy (future — not this phase)

**Today:** `Campaign → CampaignLead → Lead` (+ `Lead.campaignId`)

**Future:** `Campaign → Opportunity and/or Contact enrollments`

**Blockers to document for later phases:**

- Follow-up jobs keyed by `leadId`
- Automation pipeline (`runPipeline(organizationId, leadId)`)
- Legacy `Conversation` requires `leadId`
- Campaign stats count leads only
- No `CampaignOpportunity` / enrollment table for opportunities

**Plan:** keep campaigns working; in a later phase add opportunity/contact enrollment alongside CampaignLead, then dual-write, then cut over.

---

## 9. Conversation migration strategy (future)

**Canonical:** InboxConversation + Message linked to Company / Contact / Opportunity  

**Legacy:** Conversation rows tied to Lead (automation continues)

**Bridge today:** inbox send may also write legacy Conversation when `leadId` present.

**Later:** stop requiring Lead for automation; attach sequences to Contact/Opportunity.

---

## 10. Data migration strategy

| Approach | Phase 2 |
|----------|---------|
| Bulk lead conversion | **No** |
| On-demand bridge API/service | **Yes** (`lead-migration.service`) |
| Destructive merges | **No** |
| Unique constraints that fail on dupes | Report only; do not delete |

---

## 11. Intentionally NOT migrated yet

- Full lead retirement  
- Campaign → Opportunity rewrite  
- Conversation history merge  
- Autopilot rewrite  
- Revenue Agent / billing / LinkedIn product work  

---

## 12. Future phases to retire Leads

1. **Phase 3 (done):** SequenceEnrollment runtime for Opportunity/Contact  
2. Opportunity/Contact enrollment dual-write from CampaignLead  
3. Automation on Opportunity/Contact + inbox only  
4. Dual-write then cutover from CampaignLead / FollowUpJob  
5. Freeze lead writes; read-only legacy  
6. Optional archive/export of leads  

---

## Diagrams

### Canonical

```text
Business Brain
      ↓
Revenue Goal / ICP
      ↓
Sources
      ↓
Signals
      ↓
Company ───── Contact
      ↓
Opportunity
      ↓
Conversation (inbox)
      ↓
Meeting → Proposal → Deal → Revenue
```

### Legacy bridge

```text
LEGACY LEAD
    ↓
Compatibility Bridge
    ↓
Company + Contact + (optional) Opportunity.leadId
```

---

## Developer rule

> **New revenue functionality MUST NOT introduce new Lead dependencies.**  
> Prefer Company, Contact, Signal, Opportunity, InboxConversation, Deal, Revenue.

See also: `docs/ARCHITECTURE_RULES.md`
