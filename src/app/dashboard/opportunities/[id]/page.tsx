import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import {
  Building2,
  ExternalLink,
  Globe,
  Mail,
  MapPin,
  User,
} from "lucide-react";
import { opportunityService } from "@/services/opportunity.service";
import { getCurrentUser } from "@/lib/auth/session";
import { OpportunityDetailClient } from "@/components/opportunities/opportunity-detail-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { OPPORTUNITY_STAGE_LABELS } from "@/lib/constants/opportunities";

interface PageProps {
  params: Promise<{ id: string }>;
}

function decimalToNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (
    typeof value === "object" &&
    value !== null &&
    "toNumber" in value &&
    typeof (value as { toNumber: () => number }).toNumber === "function"
  ) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value);
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="text-sm">{children || "—"}</div>
    </div>
  );
}

export default async function OpportunityDetailPage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user?.organizationId) notFound();

  const { id } = await params;

  let opportunity;
  try {
    opportunity = await opportunityService.getById(user.organizationId, id);
  } catch {
    notFound();
  }

  const latestScore = opportunity.scores[0] ?? null;
  const estimatedValue = decimalToNumber(opportunity.estimatedValue);
  const fundingTotal = decimalToNumber(opportunity.company.fundingTotal);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/dashboard/opportunities" className="hover:underline">
          Opportunities
        </Link>
        <span>/</span>
        <span className="text-foreground">{opportunity.company.name}</span>
      </div>

      <OpportunityDetailClient
        opportunityId={opportunity.id}
        companyName={opportunity.company.name}
        score={opportunity.score}
        stage={opportunity.stage}
        status={opportunity.status}
        hasIntelligence={Boolean(opportunity.intelligence)}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Why now</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground whitespace-pre-wrap">
            {opportunity.intelligence?.whyNow ||
              opportunity.whyNow ||
              "Generate intelligence to get an evidence-backed answer."}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Likely problem</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground whitespace-pre-wrap">
            {opportunity.intelligence?.likelyProblem ||
              opportunity.likelyProblem ||
              "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recommended service</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {opportunity.recommendedService?.name ||
              opportunity.intelligence?.recommendedServiceId ||
              "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">What to do next</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground whitespace-pre-wrap">
            {opportunity.intelligence?.recommendedAction ||
              opportunity.recommendedAction ||
              "—"}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recommended offer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {opportunity.intelligence?.offerTitle ||
            opportunity.recommendedOffer ? (
              <>
                <Field label="Title">
                  {opportunity.intelligence?.offerTitle ||
                    opportunity.recommendedOffer?.name}
                </Field>
                <Field label="Problem">
                  {opportunity.intelligence?.offerProblem ||
                    opportunity.recommendedOffer?.problem ||
                    "—"}
                </Field>
                <Field label="Solution">
                  {opportunity.intelligence?.offerSolution ||
                    opportunity.recommendedOffer?.solution ||
                    "—"}
                </Field>
                <Field label="Scope">
                  {opportunity.intelligence?.offerScope ||
                    opportunity.recommendedOffer?.description ||
                    "—"}
                </Field>
                <Field label="Expected outcome">
                  {opportunity.intelligence?.offerExpectedOutcome ||
                    opportunity.recommendedOffer?.outcome ||
                    "—"}
                </Field>
                <Field label="Estimated value">
                  {decimalToNumber(
                    opportunity.intelligence?.offerEstimatedValue ??
                      opportunity.estimatedValue
                  ) != null
                    ? `${opportunity.currency} ${decimalToNumber(
                        opportunity.intelligence?.offerEstimatedValue ??
                          opportunity.estimatedValue
                      )?.toLocaleString()}`
                    : "—"}
                </Field>
                <Field label="Reasoning">
                  {opportunity.intelligence?.offerReasoning || "—"}
                </Field>
              </>
            ) : (
              <p className="text-muted-foreground">
                No offer yet — generate intelligence to recommend a configured
                service offer.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Who to contact & what to say</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Field label="Recommended contact">
              {opportunity.recommendedContact ||
              opportunity.intelligence?.recommendedContactId ? (
                <div className="space-y-1">
                  <p className="font-medium text-foreground">
                    {opportunity.recommendedContact?.fullName ||
                      "Selected contact"}
                  </p>
                  {opportunity.recommendedContact?.title && (
                    <p className="text-muted-foreground">
                      {opportunity.recommendedContact.title}
                    </p>
                  )}
                  {opportunity.recommendedContact?.email && (
                    <p className="text-muted-foreground">
                      {opportunity.recommendedContact.email}
                    </p>
                  )}
                  <p className="text-muted-foreground">
                    {opportunity.intelligence?.recommendedContactReason ||
                      opportunity.recommendedContactReason ||
                      "—"}
                  </p>
                  {(opportunity.intelligence?.recommendedContactConfidence ??
                    opportunity.recommendedContactConfidence) != null && (
                    <Badge variant="outline">
                      Confidence{" "}
                      {opportunity.intelligence?.recommendedContactConfidence ??
                        opportunity.recommendedContactConfidence}
                    </Badge>
                  )}
                </div>
              ) : (
                "—"
              )}
            </Field>
            <Field label="Outreach message">
              <p className="whitespace-pre-wrap text-muted-foreground">
                {opportunity.intelligence?.outreachMessage ||
                  opportunity.outreachMessage ||
                  "—"}
              </p>
            </Field>
            {opportunity.intelligence?.summary && (
              <Field label="Summary">
                <p className="text-muted-foreground">
                  {opportunity.intelligence.summary}
                </p>
              </Field>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Company</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span>{opportunity.company.name}</span>
              </div>
              {opportunity.company.website && (
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <a
                    href={opportunity.company.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-primary hover:underline"
                  >
                    {opportunity.company.website}
                  </a>
                </div>
              )}
              {(opportunity.company.city ||
                opportunity.company.country) && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {[
                      opportunity.company.city,
                      opportunity.company.state,
                      opportunity.company.country,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                </div>
              )}
              <div className="space-y-1 pt-2 text-muted-foreground">
                {opportunity.company.industry && (
                  <p>Industry: {opportunity.company.industry}</p>
                )}
                {opportunity.company.employeeCount != null && (
                  <p>Employees: {opportunity.company.employeeCount}</p>
                )}
                {opportunity.company.size && (
                  <p>Size: {opportunity.company.size}</p>
                )}
                {fundingTotal != null && (
                  <p>Funding: {fundingTotal.toLocaleString()}</p>
                )}
                {estimatedValue != null && (
                  <p>
                    Est. value: {opportunity.currency}{" "}
                    {estimatedValue.toLocaleString()}
                  </p>
                )}
                {opportunity.owner && (
                  <p>
                    Owner: {opportunity.owner.firstName}{" "}
                    {opportunity.owner.lastName}
                  </p>
                )}
                {opportunity.campaign && (
                  <p>
                    Campaign:{" "}
                    <Link
                      href={`/dashboard/campaigns/${opportunity.campaign.id}`}
                      className="text-primary hover:underline"
                    >
                      {opportunity.campaign.name}
                    </Link>
                  </p>
                )}
                {opportunity.source && (
                  <p>Source: {opportunity.source.name}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contacts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {opportunity.company.contacts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No contacts yet.</p>
              ) : (
                opportunity.company.contacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="space-y-1 border-b border-border pb-3 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      {contact.fullName}
                      {opportunity.primaryContactId === contact.id && (
                        <Badge variant="outline" className="text-xs">
                          Primary
                        </Badge>
                      )}
                      {opportunity.recommendedContactId === contact.id && (
                        <Badge variant="secondary" className="text-xs">
                          Recommended
                        </Badge>
                      )}
                    </div>
                    {contact.title && (
                      <p className="text-xs text-muted-foreground">
                        {contact.title}
                      </p>
                    )}
                    {contact.email && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        {contact.email}
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Signals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {opportunity.company.signals.length === 0 ? (
                <p className="text-sm text-muted-foreground">No signals.</p>
              ) : (
                opportunity.company.signals.map((signal) => (
                  <div
                    key={signal.id}
                    className="space-y-1 border-b border-border pb-3 last:border-0 last:pb-0"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{signal.title}</span>
                      <Badge variant="outline" className="text-xs">
                        {signal.type}
                      </Badge>
                      {opportunity.primarySignalId === signal.id && (
                        <Badge variant="secondary" className="text-xs">
                          Primary
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        conf. {signal.confidence}
                      </span>
                    </div>
                    {signal.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {signal.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Detected{" "}
                      {format(new Date(signal.detectedAt), "MMM d, yyyy")}
                    </p>
                    {signal.evidenceUrl && (
                      <a
                        href={signal.evidenceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        Evidence <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Latest score breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              {!latestScore ? (
                <p className="text-sm text-muted-foreground">No scores yet.</p>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">
                      Total {latestScore.totalScore}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(latestScore.createdAt), "MMM d, yyyy HH:mm")}
                      {latestScore.model ? ` · ${latestScore.model}` : ""}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {latestScore.explanation}
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {[
                      ["ICP Fit", latestScore.icpFit],
                      ["Signal Strength", latestScore.signalStrength],
                      ["Urgency", latestScore.urgency],
                      ["Service Fit", latestScore.serviceFit],
                      ["Reachability", latestScore.reachability],
                      ["Freshness", latestScore.freshness],
                      ["Budget Potential", latestScore.budgetPotential],
                      ["Growth", latestScore.growth],
                      ["Hist. Conversion", latestScore.historicalConversion],
                    ].map(([label, value]) => (
                      <div
                        key={String(label)}
                        className="rounded-md border px-3 py-2"
                      >
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="text-sm font-medium">{value}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm font-medium">
                    Overall: {latestScore.totalScore}/100
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Activity timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {opportunity.events.length === 0 ? (
                <p className="text-sm text-muted-foreground">No events yet.</p>
              ) : (
                opportunity.events.map((event) => (
                  <div
                    key={event.id}
                    className="flex gap-3 border-b border-border pb-3 last:border-0 last:pb-0"
                  >
                    <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-muted-foreground/40" />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {event.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(event.createdAt), "MMM d, yyyy HH:mm")}
                        </span>
                      </div>
                      <p className="text-sm">
                        {event.title || OPPORTUNITY_STAGE_LABELS[opportunity.stage]}
                      </p>
                      {event.description && (
                        <p className="text-sm text-muted-foreground">
                          {event.description}
                        </p>
                      )}
                      {event.actor && (
                        <p className="text-xs text-muted-foreground">
                          by {event.actor.firstName} {event.actor.lastName}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {opportunity.lead && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Linked lead</CardTitle>
                <Link href={`/dashboard/leads/${opportunity.lead.id}`}>
                  <Button variant="outline" size="sm">
                    Open lead
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {opportunity.lead.fullName}
                  {opportunity.lead.companyName
                    ? ` · ${opportunity.lead.companyName}`
                    : ""}
                </p>

                <Field label="Conversations">
                  {opportunity.lead.conversations.length === 0 ? (
                    <span className="text-muted-foreground">None</span>
                  ) : (
                    <ul className="space-y-1">
                      {opportunity.lead.conversations.slice(0, 5).map((c) => (
                        <li key={c.id} className="text-muted-foreground">
                          {c.channel}
                          {c.subject ? ` · ${c.subject}` : ""} ·{" "}
                          {format(new Date(c.createdAt), "MMM d")}
                        </li>
                      ))}
                      <li>
                        <Link
                          href="/dashboard/conversations"
                          className="text-primary hover:underline"
                        >
                          View conversations
                        </Link>
                      </li>
                    </ul>
                  )}
                </Field>

                <Field label="Tasks">
                  {opportunity.lead.tasks.length === 0 ? (
                    <span className="text-muted-foreground">None</span>
                  ) : (
                    <ul className="space-y-1">
                      {opportunity.lead.tasks.slice(0, 5).map((t) => (
                        <li key={t.id} className="text-muted-foreground">
                          {t.title} · {t.status}
                          {t.dueDate
                            ? ` · due ${format(new Date(t.dueDate), "MMM d")}`
                            : ""}
                        </li>
                      ))}
                      <li>
                        <Link
                          href="/dashboard/tasks"
                          className="text-primary hover:underline"
                        >
                          View tasks
                        </Link>
                      </li>
                    </ul>
                  )}
                </Field>

                <Field label="Meetings">
                  {opportunity.lead.meetings.length === 0 ? (
                    <span className="text-muted-foreground">None</span>
                  ) : (
                    <ul className="space-y-1">
                      {opportunity.lead.meetings.slice(0, 5).map((m) => (
                        <li key={m.id} className="text-muted-foreground">
                          {m.title} · {m.outcome} ·{" "}
                          {format(new Date(m.date), "MMM d, yyyy")}
                        </li>
                      ))}
                      <li>
                        <Link
                          href="/dashboard/meetings"
                          className="text-primary hover:underline"
                        >
                          View meetings
                        </Link>
                      </li>
                    </ul>
                  )}
                </Field>

                <Field label="Proposals">
                  {opportunity.lead.proposals.length === 0 ? (
                    <span className="text-muted-foreground">None</span>
                  ) : (
                    <ul className="space-y-1">
                      {opportunity.lead.proposals.slice(0, 5).map((p) => (
                        <li key={p.id} className="text-muted-foreground">
                          {p.title} · {p.status}
                          {decimalToNumber(p.totalPrice) != null
                            ? ` · ${p.currency} ${decimalToNumber(p.totalPrice)}`
                            : ""}
                        </li>
                      ))}
                      <li>
                        <Link
                          href="/dashboard/proposals"
                          className="text-primary hover:underline"
                        >
                          View proposals
                        </Link>
                      </li>
                    </ul>
                  )}
                </Field>

                <Field label="Deals">
                  {opportunity.lead.deals.length === 0 ? (
                    <span className="text-muted-foreground">None</span>
                  ) : (
                    <ul className="space-y-1">
                      {opportunity.lead.deals.map((d) => (
                        <li key={d.id} className="text-muted-foreground">
                          {d.name} · {d.stage} · {d.currency}{" "}
                          {decimalToNumber(d.estimatedValue)?.toLocaleString() ??
                            "—"}
                        </li>
                      ))}
                      <li>
                        <Link
                          href="/dashboard/pipeline"
                          className="text-primary hover:underline"
                        >
                          View pipeline
                        </Link>
                      </li>
                    </ul>
                  )}
                </Field>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
