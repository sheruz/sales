import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ExternalLink, Link2 } from "lucide-react";
import { companyService } from "@/services/company.service";
import { getCurrentUser } from "@/lib/auth/session";
import { hasAnyOrgPermission } from "@/lib/tenant/scope";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EntityRelatedLinks } from "@/components/crm/entity-related-links";
import { EmptyState } from "@/components/crm/empty-state";
import {
  CrawlStatusBadge,
  EnrichmentStatusBadge,
  FunnelStageBadge,
  SourceBadge,
  StatusBadge,
  VerificationBadge,
} from "@/components/status/status-badge";
import { displayContactName } from "@/lib/crm/display-name";
import type { FunnelStageKey } from "@/lib/crm/funnel-stage";
import { CompanyAuditPitchCards } from "@/components/companies/company-audit-pitch-cards";

interface PageProps {
  params: Promise<{ id: string }>;
}

function nextStepCopy(input: {
  funnelStage: FunnelStageKey;
  crawlStatus: string | null;
  enrichmentStatus: string | null;
  pitchStatus?: string | null;
}): { title: string; body: string } {
  if (input.enrichmentStatus === "SKIPPED") {
    return {
      title: "Skipped",
      body: "Enrichment was skipped. Use Unskip on the companies list to re-queue.",
    };
  }
  if (input.pitchStatus === "APPROVED") {
    return {
      title: "Pitch approved — in outbound queue",
      body: "Autopilot → Outbound enrolls this pitch and queues email. Cron sends Mon–Fri 8–11 prospect local time; Process outbox sends queued mail immediately. Preview below is the first message.",
    };
  }
  if (input.funnelStage === "audited") {
    return {
      title: "Pitch ready to review",
      body: "Approve the pitch on this page (or Autopilot → Pitch review). Outbound only sends APPROVED pitches — nothing sends until then.",
    };
  }
  if (input.funnelStage === "enriched") {
    return {
      title: "Ready for website audit",
      body: "Contact is enriched. Use Autopilot → Audit → Audit now (or Audit now on this page).",
    };
  }
  if (
    input.crawlStatus === "PENDING" ||
    (!input.crawlStatus && input.funnelStage === "found")
  ) {
    return {
      title: "Waiting for crawl",
      body: "Auto-crawl or Crawl now will fetch website emails, then enrichment can run.",
    };
  }
  if (input.funnelStage === "crawled") {
    return {
      title: "Waiting for enrichment",
      body: "Use Autopilot → Enrichment → Enrich now, or on this page click Use client details if you already entered the contact.",
    };
  }
  if (
    input.enrichmentStatus !== "ENRICHED" &&
    input.enrichmentStatus !== "SKIPPED"
  ) {
    return {
      title: "Waiting for enrichment",
      body: "Manual lead? Click Use client details on the audit card (needs website + contact email), then Audit now. Or run Hunter enrichment.",
    };
  }
  return {
    title: "In progress",
    body: "This company is moving through the Autopilot funnel.",
  };
}

export default async function CompanyDetailPage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user?.organizationId) notFound();
  if (!hasAnyOrgPermission(user, ["opportunities.view", "leads.view"])) {
    notFound();
  }

  const { id } = await params;
  let company;
  try {
    company = await companyService.getById(user.organizationId, id);
  } catch {
    notFound();
  }

  const meta =
    company.metadata && typeof company.metadata === "object"
      ? (company.metadata as { google?: { rating?: number } })
      : {};
  const rating = meta.google?.rating;
  const website = company.website || (company.domain ? `https://${company.domain}` : null);
  const next = nextStepCopy({
    funnelStage: company.funnelStage,
    crawlStatus: company.crawlStatus,
    enrichmentStatus: company.enrichmentStatus,
    pitchStatus: company.activePitch?.status ?? null,
  });

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-2xl font-bold tracking-tight">{company.name}</h2>
          <SourceBadge source={company.source} />
          <FunnelStageBadge stage={company.funnelStage} />
          <CrawlStatusBadge status={company.crawlStatus} />
          <EnrichmentStatusBadge status={company.enrichmentStatus} />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {rating != null ? <span>★ {rating}</span> : null}
          {company.phone ? <span>{company.phone}</span> : null}
          {company.address ? <span>{company.address}</span> : null}
          {(company.city || company.country) && (
            <span>
              {[company.city, company.country].filter(Boolean).join(", ")}
            </span>
          )}
          {website ? (
            <a
              href={website}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 hover:underline text-foreground"
            >
              Website <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
        </div>
        <EntityRelatedLinks
          links={[
            {
              href: `/dashboard/contacts?companyId=${company.id}`,
              label: `Contacts (${company._count.contacts})`,
            },
            {
              href: `/dashboard/opportunities?filter=sourced`,
              label: `Opportunities (${company._count.opportunities})`,
            },
            {
              href: "/dashboard/conversations",
              label: `Inbox (${company.inboxConversations.length})`,
            },
          ]}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Next step</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-medium">{next.title}</p>
          <p className="text-sm text-muted-foreground mt-1">{next.body}</p>
        </CardContent>
      </Card>

      <CompanyAuditPitchCards
        companyId={company.id}
        enrichmentStatus={company.enrichmentStatus}
        contactCount={
          company.contacts.filter((c) => Boolean(c.email?.trim())).length
        }
        latestAudit={
          company.latestAudit
            ? {
                ...company.latestAudit,
                checks: Array.isArray(company.latestAudit.checks)
                  ? (company.latestAudit.checks as Array<{
                      id: string;
                      label: string;
                      pass: boolean | null;
                      evidence: string;
                      severity: string;
                    }>)
                  : null,
                findings:
                  company.latestAudit.findings &&
                  typeof company.latestAudit.findings === "object"
                    ? (company.latestAudit.findings as {
                        top_issues?: Array<{
                          issue: string;
                          evidence: string;
                          business_impact: string;
                        }>;
                      })
                    : null,
              }
            : null
        }
        activePitch={company.activePitch}
        newerAuditAvailable={company.newerAuditAvailable}
        emailPreview={company.emailPreview}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contacts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {company.contacts.length === 0 ? (
              <EmptyState
                title="No contacts yet"
                description="Contacts appear after Hunter enrichment (or website email fallback). Use Autopilot → Enrichment."
                actionHref="/dashboard/autopilot?tab=enrichment"
                actionLabel="Open Enrichment"
              />
            ) : (
              company.contacts.map((c) => {
                const display = displayContactName(c.fullName, c.email);
                return (
                  <Link
                    key={c.id}
                    href={`/dashboard/contacts/${c.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 hover:bg-muted/40"
                  >
                    <div>
                      <div className="font-medium flex flex-wrap items-center gap-2">
                        {display.label}
                        {display.isGeneralInbox ? (
                          <StatusBadge label="General inbox" tone="muted" />
                        ) : null}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {[c.title, c.email].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <VerificationBadge status={c.emailStatus} />
                      {c.linkedInUrl ? (
                        <span title="LinkedIn">
                          <Link2 className="h-4 w-4 text-muted-foreground" />
                        </span>
                      ) : null}
                    </div>
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Website emails</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {company.emails.length === 0 ? (
              <p className="text-muted-foreground">
                No crawled emails yet. Crawl runs after Places sourcing when
                Auto-crawl is ON.
              </p>
            ) : (
              company.emails.map((e) => (
                <div
                  key={e.id}
                  className="flex flex-wrap justify-between gap-2 border-b border-border py-1 last:border-0"
                >
                  <span>{e.email}</span>
                  <span className="text-xs text-muted-foreground">
                    {e.type}
                    {e.sourcePage ? ` · ${e.sourcePage}` : ""}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activity timeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {company.timelineEvents.length === 0 ? (
            <p className="text-muted-foreground">
              Timeline events appear as Autopilot sources, crawls, and enriches
              this company. Run migrate backfill if this company predates Phase
              2.5.
            </p>
          ) : (
            company.timelineEvents.map((ev) => (
              <div key={ev.id} className="border-l-2 border-border pl-3">
                <p className="font-medium">{ev.title}</p>
                <p className="text-xs text-muted-foreground">
                  {ev.type} · {format(ev.createdAt, "MMM d, yyyy · HH:mm")}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Opportunities</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {company.opportunities.length === 0 ? (
            <p className="text-muted-foreground">
              Sourced opportunities are created when enrichment succeeds.
            </p>
          ) : (
            company.opportunities.map((o) => (
              <Link
                key={o.id}
                href={`/dashboard/opportunities/${o.id}`}
                className="flex justify-between hover:underline"
              >
                <span>
                  {o.stage}
                  {o.primaryContact ? ` · ${o.primaryContact.fullName}` : ""}
                </span>
                <span className="text-muted-foreground">
                  {format(o.updatedAt, "MMM d")}
                </span>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
