# Architecture rules (developer-facing)

## Canonical CRM (Revenue OS)

Prefer these entities for **new** product work:

- Company, Contact, Signal, Opportunity
- InboxConversation / Message
- Meeting, Proposal, Deal, Revenue
- Business Brain, ICP, Services/Offers, Revenue Goals, Source connectors
- **Campaign → OutreachSequence → SequenceEnrollment → Executor** (Phase 3)

## Canonical campaign runtime (Phase 3)

```text
Opportunity / Contact
      ↓
Campaign (optional)
      ↓
OutreachSequence
      ↓
SequenceEnrollment
      ↓
Sequence Executor (cron)
      ↓
inboxService.sendOutreach (existing email engine)
      ↓
InboxConversation / Message
      ↓
Reply / Meeting / Stop
```

**Rules:**

- New enrollments MUST NOT require `Lead`
- `SequenceEnrollment.leadId` is optional legacy bridge only
- Reuse `inboxService` + `emailSafetyService` — do **not** add a second email send engine
- Duplicate open enrollments blocked (partial unique + app check)

## Legacy runtime (still active)

```text
Lead
  ↓
CampaignLead → Campaign
  ↓
Autopilot / FollowUpJob / FollowUpSequence (JSON)
  ↓
aiOutreachService / sendEmailForUser
  ↓
Legacy Conversation
```

**Why both exist:** Production still depends on Lead automation; Phase 3 is additive.

**Future migration:** dual-write → enroll Opportunities from CampaignLead → cut over FollowUpJob → retire Lead automation.

## Legacy Lead freeze

`Lead` (and CampaignLead / lead-only Conversation) remain for **compatibility**.

**Do not:**

- Add new features that *require* a Lead to exist
- Make Opportunity or SequenceEnrollment creation depend on Lead
- Treat Lead as the long-term CRM center of gravity

**Do:**

- Keep existing lead flows working
- Use `lead-migration.service` for optional Lead → Company/Contact bridging
- Prefer SequenceEnrollment for new outreach automation

## Authorization

Customer APIs use Phase 1 org RBAC only:

`requireOrgPermission` / `requireAnyOrgPermission` + `{ id, organizationId }` lookups.

Never trust client-supplied `organizationId` for authorization.
