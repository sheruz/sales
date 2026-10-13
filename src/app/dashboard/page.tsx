import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserReadiness } from "@/lib/integrations/readiness";
import { hasAnyOrgPermission, hasOrgPermission } from "@/lib/tenant/scope";
import { analyticsService } from "@/services/analytics.service";
import { SetupChecklist } from "@/components/dashboard/setup-checklist";
import { DailyRevenueCopilot } from "@/components/dashboard/daily-revenue-copilot";
import { AnalyticsClient } from "@/components/dashboard/analytics-client";
import { EmptyState } from "@/components/crm/empty-state";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Briefcase,
  CircleDollarSign,
  Flame,
  MessageSquare,
  Target,
} from "lucide-react";
import { ROLE_LABELS } from "@/lib/auth/permissions";

/** Clickable architecture strip — only routes that exist. */
const FLOW = [
  { label: "Sources", href: "/dashboard/sources" },
  { label: "Companies", href: "/dashboard/companies" },
  { label: "Contacts", href: "/dashboard/contacts" },
  { label: "Opportunities", href: "/dashboard/opportunities" },
  { label: "Campaigns", href: "/dashboard/campaigns" },
  { label: "Sequences", href: "/dashboard/sequences" },
  { label: "Inbox", href: "/dashboard/conversations" },
  { label: "Meetings", href: "/dashboard/meetings" },
  { label: "Proposals", href: "/dashboard/proposals" },
  { label: "Pipeline / Deals", href: "/dashboard/pipeline" },
  { label: "Revenue goals", href: "/dashboard/revenue-goals" },
] as const;

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const canAnalytics = hasOrgPermission(user, "analytics.view");
  const canOpps = hasOrgPermission(user, "opportunities.view");
  const canInbox = hasOrgPermission(user, "conversations.view");
  const canCampaigns = hasAnyOrgPermission(user, [
    "campaigns.view",
    "campaigns.manage",
  ]);
  const canSequences = hasAnyOrgPermission(user, [
    "sequences.view",
    "sequences.manage",
  ]);
  const canBrain = hasOrgPermission(user, "business_brain.manage");
  const canSources = hasOrgPermission(user, "integrations.manage");

  const [readiness, metrics] = await Promise.all([
    user.organizationId
      ? getUserReadiness(user.organizationId, user.id)
      : Promise.resolve(null),
    user.organizationId
      ? analyticsService.getRevenueDashboard(user.organizationId)
      : Promise.resolve(null),
  ]);

  const currency = metrics?.currency ?? "USD";
  const fmt = (n: number) =>
    `${currency} ${Math.round(n).toLocaleString()}`;

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const incomplete = readiness?.steps.find((s) => !s.done) ?? null;

  const primaryCta = incomplete
    ? { href: incomplete.href, label: incomplete.label }
    : canInbox
      ? { href: "/dashboard/conversations", label: "Review inbox" }
      : canOpps
        ? { href: "/dashboard/opportunities", label: "Work opportunities" }
        : canSequences
          ? { href: "/dashboard/sequences", label: "Open sequences" }
          : canCampaigns
            ? { href: "/dashboard/campaigns", label: "Open campaigns" }
            : canBrain
              ? { href: "/dashboard/business-brain", label: "Configure Business Brain" }
              : { href: "/dashboard/settings", label: "Open settings" };

  const snapshot = metrics
    ? [
        {
          label: "Revenue",
          value: fmt(metrics.revenueAchieved),
          sub:
            metrics.revenueProgress != null
              ? `${metrics.revenueProgress}% of ${fmt(metrics.revenueTarget)}`
              : metrics.revenueTarget
                ? `Goal ${fmt(metrics.revenueTarget)}`
                : "No active goal configured",
          href: "/dashboard/revenue-goals",
          icon: CircleDollarSign,
        },
        {
          label: "Open opportunities",
          value: String(metrics.opportunities),
          sub: `${metrics.qualifiedOpportunities} qualified`,
          href: "/dashboard/opportunities",
          icon: Flame,
        },
        {
          label: "Open pipeline",
          value: fmt(metrics.pipelineValue),
          sub: `Weighted ${fmt(metrics.weightedPipeline)}`,
          href: "/dashboard/pipeline",
          icon: Briefcase,
        },
        {
          label: "Won deals",
          value: String(metrics.dealsWon),
          sub: `${metrics.winRate}% win rate`,
          href: "/dashboard/pipeline",
          icon: Target,
        },
        {
          label: "Meetings",
          value: String(metrics.meetings),
          sub: `${metrics.proposals} proposals`,
          href: "/dashboard/meetings",
          icon: MessageSquare,
        },
      ]
    : [];

  const actions: { title: string; href: string; reason: string }[] = [];
  if (readiness && readiness.percentComplete < 100) {
    for (const step of readiness.steps) {
      if (!step.done) {
        actions.push({
          title: step.label,
          href: step.href,
          reason: "Not configured",
        });
      }
    }
  }
  if (canInbox) {
    actions.push({
      title: "Review inbox",
      href: "/dashboard/conversations",
      reason: "Replies and next actions",
    });
  }
  if (canOpps) {
    actions.push({
      title: "Advance opportunities",
      href: "/dashboard/opportunities",
      reason: "Open pipeline work",
    });
  }
  if (canSequences) {
    actions.push({
      title: "Manage sequences",
      href: "/dashboard/sequences",
      reason: "Canonical outreach",
    });
  }
  if (canCampaigns) {
    actions.push({
      title: "Review campaigns",
      href: "/dashboard/campaigns",
      reason: "Enrollments and analytics",
    });
  }
  if (canSources) {
    actions.push({
      title: "Check sources",
      href: "/dashboard/sources",
      reason: "Signal ingestion",
    });
  }

  const uniqueActions = actions
    .filter(
      (a, i, arr) =>
        arr.findIndex((x) => x.href === a.href && x.title === a.title) === i
    )
    .slice(0, 8);

  const summaryParts: string[] = [];
  if (metrics) {
    summaryParts.push(
      `${metrics.opportunities} open opportunities`,
      `${fmt(metrics.pipelineValue)} pipeline`,
      `${metrics.dealsWon} won`
    );
  }
  if (readiness && readiness.percentComplete < 100) {
    summaryParts.push(`setup ${readiness.percentComplete}% complete`);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {greeting}, {user.firstName}
          </h2>
          <p className="text-muted-foreground">
            {summaryParts.length
              ? summaryParts.join(" · ")
              : "Your Delvix overview — configure intelligence, then run the pipeline."}
            <Badge variant="secondary" className="ml-2">
              {user.organizationRoleKey
                ? user.organizationRoleKey.replace(/_/g, " ")
                : ROLE_LABELS[user.role]}
            </Badge>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={primaryCta.href}>
            <Button>{primaryCta.label}</Button>
          </Link>
          {canInbox && primaryCta.href !== "/dashboard/conversations" ? (
            <Link href="/dashboard/conversations">
              <Button variant="outline">View inbox</Button>
            </Link>
          ) : canOpps && primaryCta.href !== "/dashboard/opportunities" ? (
            <Link href="/dashboard/opportunities">
              <Button variant="outline">Opportunities</Button>
            </Link>
          ) : null}
        </div>
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Attention
        </h3>
        <SetupChecklist readiness={readiness} />
        {uniqueActions.length === 0 ? (
          <EmptyState
            title="No actions queued"
            description="Setup looks complete for this snapshot. Work opportunities, inbox, and campaigns as activity arrives."
          />
        ) : (
          <div className="divide-y rounded-lg border">
            {uniqueActions.map((a) => (
              <Link
                key={`${a.href}-${a.title}`}
                href={a.href}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/40"
              >
                <div>
                  <p className="text-sm font-medium">{a.title}</p>
                  <p className="text-xs text-muted-foreground">{a.reason}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        )}
      </section>

      {snapshot.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Revenue snapshot
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {snapshot.map((stat) => (
              <Link key={stat.label} href={stat.href} className="block">
                <Card className="h-full transition-colors hover:bg-muted/40">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {stat.label}
                    </CardTitle>
                    <stat.icon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stat.value}</div>
                    <p className="mt-1 text-xs text-muted-foreground">{stat.sub}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <EmptyState
          title="No revenue metrics yet"
          description="Metrics appear after opportunities, deals, or recognized revenue exist for this organization."
          actionHref={canOpps ? "/dashboard/opportunities" : undefined}
          actionLabel={canOpps ? "Go to opportunities" : undefined}
        />
      )}

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Revenue flow
        </h3>
        <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-muted/20 p-3 text-sm">
          {FLOW.map((step, i) => (
            <span key={step.href} className="flex items-center gap-1">
              {i > 0 ? (
                <ArrowRight className="mx-1 h-3.5 w-3.5 text-muted-foreground" />
              ) : null}
              <Link
                href={step.href}
                className="rounded px-1.5 py-0.5 font-medium hover:bg-muted"
              >
                {step.label}
              </Link>
            </span>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Canonical path from market signals to revenue. Pipeline is the
          opportunity/deal board. Leads &amp; Autopilot remain under Legacy.
        </p>
      </section>

      {canOpps ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Pipeline
            </h3>
            <Link href="/dashboard/pipeline">
              <Button variant="outline" size="sm">
                View pipeline
              </Button>
            </Link>
          </div>
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm">
              <div>
                <p className="font-medium">
                  {metrics
                    ? `${metrics.opportunities} open · ${fmt(metrics.pipelineValue)} value`
                    : "Opportunity and deal progression"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Move opportunities through stages into won deals and revenue.
                </p>
              </div>
              <Link href="/dashboard/opportunities">
                <Button variant="ghost" size="sm">
                  Opportunities
                </Button>
              </Link>
            </CardContent>
          </Card>
        </section>
      ) : null}

      {user.organizationId ? <DailyRevenueCopilot /> : null}

      {canAnalytics && user.organizationId ? (
        <section className="space-y-4 border-t pt-6">
          <div>
            <h3 className="text-lg font-semibold tracking-tight">Analytics</h3>
            <p className="text-sm text-muted-foreground">
              Live organization funnel, sources, and conversions — no invented
              open/click rates.
            </p>
          </div>
          <AnalyticsClient />
        </section>
      ) : null}
    </div>
  );
}
