# SECURITY AUDIT

**Date:** 2026-09-04  
**Scope:** Code inspection only — no exploit development, no production probing beyond public login page earlier  
**Audit only**

---

## Executive security posture

Core opportunity/deal/inbox/source-connector **ID lookups are generally org-scoped** (`where: { id, organizationId }`).  

However: **dual RBAC**, **unscoped notes/activities/AI research**, and **middleware cookie-presence checks** leave material risks before calling the product “production-hardened.”

---

## Authentication & sessions

| Control | Status | Notes |
|---------|--------|-------|
| Password hashing | Pass (assumed bcrypt/argon in auth.service — verify on change) | Standard login/signup |
| Session cookie `session_token` | Pass | httpOnly, sameSite=lax, secure in production |
| Session token hashed at rest | Pass | `hashToken` + plaintext migration lookup |
| Session expiry | Pass | `expiresAt` checked |
| Middleware auth | **Partial** | Cookie **presence** only — not validity |
| Login ↔ dashboard loop | Mitigated | Middleware no longer bounce login→dashboard on cookie alone |
| Brute-force lockout | Pass | Phase 13 |
| Rate limiting | Pass | Auth/webhooks windows |
| Password reset | Pass | Hashed tokens + email when SMTP configured |
| CSRF | Mitigated | Cookie + SameSite; no CSRF tokens |
| Super Admin isolation | Pass (UI) | Layout redirects SUPER_ADMIN off `/dashboard` |

---

## Authorization (RBAC)

### Two systems (Critical architecture risk)

1. **Org RBAC** — `permission-catalog` + `organization_users.role` → `user.permissions` → `requireOrgPermission`  
2. **Legacy `UserRole`** on `users.role` → `hasPermission` / `requirePermission` (`leads:read`, `ai:use`, …)

**Org roles:** `company_admin`, `sales_manager`, `sales_rep`, `viewer` (+ `platform_admin` key).  
**Enum roles:** `SUPER_ADMIN`, `ADMIN`, `SALES_MANAGER`, `SALES_REPRESENTATIVE` — **no VIEWER enum**.

| Issue | Impact |
|-------|--------|
| Many CRM/email/AI APIs use **legacy** gates only | Org **viewer** with `UserRole=SALES_REPRESENTATIVE` (or ADMIN) may pass API checks nav hides |
| Org **sales_rep** lacks `campaigns.manage` / `analytics.view` in catalog, but legacy rep has `campaigns:write` + `ai:use` | Backend ≠ sidebar |
| Settings nav uses legacy `settings:read` | Diverges from org permissions |
| Platform admin short-circuits `hasOrgPermission` to true | Correct for support if they enter org context; they cannot use dashboard layout as SUPER_ADMIN |

### Feature matrix (backend intent — mixed enforcement)

Legend: ✓ enforced org perm or safe deny · ~ legacy UserRole only · ✗ weak/missing · P = platform only

| Feature | Super Admin | Company Admin | Manager | Rep | Viewer |
|---------|-------------|---------------|---------|-----|--------|
| Platform console | ✓ P | ✗ | ✗ | ✗ | ✗ |
| Org dashboard | ✗ (redirect) | ✓ | ✓ | ✓ | ✓ |
| Opportunities CRUD | P bypass | ✓ org | ✓ org | ✓ org (limited create?) | ✓ view org |
| Analytics API | P | ✓ org | ✓ org | ✗ org | ✓ org |
| Agent | P | ✓ org | ✓ org | ✗ org | ✗ org |
| Billing | P | ✓ org | ✗ org | ✗ | ✗ |
| Deals/Meetings/Proposals APIs | P | ~ legacy | ~ legacy | ~ legacy | ~ if UserRole allows |
| Campaigns APIs | P | ~ | ~ | ~ | ~ |
| Inbox APIs | P | ~ | ~ | ~ | ~ |
| Lead notes/activities | P | **IDOR risk** | **IDOR** | **IDOR** | **IDOR** |
| AI research by leadId | P | **IDOR risk** | **IDOR** | **IDOR** | if `ai:use` |

Do **not** trust frontend nav as access control.

---

## Multi-tenancy / IDOR

### Conceptual attack: Org A user → `GET /api/opportunities/{org-B-id}`

**Verdict: Blocked** for opportunities — service uses `{ id, organizationId }` + `requireOrgPermission` + `requireOrganizationContext`.

### Same pattern — generally **SAFE** when orgId passed

Deals, meetings, proposals, tasks, campaigns, leads CRUD, conversations (inbox), source connectors.

### Confirmed **RISK** (cross-tenant by UUID)

| Endpoint | Issue |
|----------|-------|
| `GET/POST /api/leads/[id]/notes` | No org context; `note.service` loads lead by id only; `Note` has **no organizationId** |
| `GET /api/leads/[id]/activities` | No org context; activities by `leadId` only |
| `POST/GET /api/ai/research/[leadId]` | `requirePermission("ai:use")` only; research loads any lead by id |

### Other isolation notes

| Area | Verdict |
|------|---------|
| Companies / contacts APIs | No public ID API — lower surface; still accessible via nested includes |
| Cron `/api/cron/automation` | Multi-org by design; **fail-closed** if `CRON_SECRET` missing in production; open if unset in non-prod |
| Website visitor webhook | Secret bound to connector |
| Stripe webhook | Signature + idempotent event store |
| Privacy export/delete | Org permission gated |
| `job_logs` | No organizationId — telemetry leakage risk between tenants if exposed |
| AI prompts | Org-scoped brain/opps when using intelligence paths; untrusted wrap present (Phase 13) |

`orgWhere` / `assertSameOrganization` exist in `scope.ts` but are **unused** in production routes — isolation is convention-based.

---

## Other security controls

| Area | Status | Notes |
|------|--------|-------|
| SQL injection | Pass | Prisma |
| XSS | Pass | React escape + CSP headers (Phase 13) |
| SSRF | Pass | Outbound URL guard on fetches |
| OAuth state | Pass | Encrypted state for Gmail/Outlook |
| Token encryption | Pass | AES-GCM for integration credentials |
| Webhook signatures | Pass | Stripe; visitor timing-safe secret |
| File uploads | Pass | CSV size/row limits on import |
| Secrets in logs | Partial | redaction helpers exist; not proven on all paths |
| Audit logging | Partial | login/privacy; agent not fully in `audit_logs` |
| Data export/deletion | Present | `/api/privacy/data` |
| Entitlement bypass | Largely Pass | Server checks on AI/email/opps/connectors — Free cannot rely on UI alone; still verify every new endpoint |

---

## Highest priority security fixes (do not implement in this audit)

1. **Critical:** Fix notes / activities / AI research IDOR (org scope + schema orgId).  
2. **Critical:** Finish migration to **single** org permission system on all APIs.  
3. **High:** Ensure Viewer / Rep cannot call legacy-gated mutating APIs.  
4. **High:** Add `organizationId` to `job_logs` (and never expose cross-tenant).  
5. **Medium:** Expand audit_logs for agent, billing, admin actions.

---

## STOP

No security patches applied in this pass.
