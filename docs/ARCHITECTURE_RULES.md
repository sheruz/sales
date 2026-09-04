# Architecture rules (developer-facing)

## Canonical CRM (Revenue OS)

Prefer these entities for **new** product work:

- Company, Contact, Signal, Opportunity
- InboxConversation / Message
- Meeting, Proposal, Deal, Revenue
- Business Brain, ICP, Services/Offers, Revenue Goals, Source connectors

## Legacy Lead freeze

`Lead` (and CampaignLead / lead-only Conversation) remain for **compatibility** with campaigns, autopilot, and historical data.

**Do not:**

- Add new features that *require* a Lead to exist
- Make Opportunity creation depend on Lead
- Treat Lead as the long-term CRM center of gravity

**Do:**

- Keep existing lead flows working
- Use `lead-migration.service` for optional Lead → Company/Contact bridging
- Keep `Opportunity.leadId` / `Contact.leadId` optional bridges only

## Authorization

Customer APIs use Phase 1 org RBAC only:

`requireOrgPermission` / `requireAnyOrgPermission` + `{ id, organizationId }` lookups.

Never trust client-supplied `organizationId` for authorization.
