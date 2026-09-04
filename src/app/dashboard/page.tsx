import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserReadiness } from "@/lib/integrations/readiness";
import { analyticsService } from "@/services/analytics.service";
import { SetupChecklist } from "@/components/dashboard/setup-checklist";
import { DailyRevenueCopilot } from "@/components/dashboard/daily-revenue-copilot";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Briefcase,
  Calendar,
  CircleDollarSign,
  FileText,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { ROLE_LABELS } from "@/lib/auth/permissions";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

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

  const statCards = metrics
    ? [
        {
          label: "Revenue target",
          value: fmt(metrics.revenueTarget),
          icon: Target,
          href: "/dashboard/revenue-goals",
        },
        {
          label: "Revenue achieved",
          value: fmt(metrics.revenueAchieved),
          sub:
            metrics.revenueProgress != null
              ? `${metrics.revenueProgress}% of target`
              : undefined,
          icon: CircleDollarSign,
        },
        {
          label: "Pipeline value",
          value: fmt(metrics.pipelineValue),
          icon: Briefcase,
          href: "/dashboard/pipeline",
        },
        {
          label: "Weighted pipeline",
          value: fmt(metrics.weightedPipeline),
          icon: TrendingUp,
        },
        {
          label: "Opportunities",
          value: String(metrics.opportunities),
          sub: `${metrics.qualifiedOpportunities} qualified`,
          icon: Users,
          href: "/dashboard/opportunities",
        },
        {
          label: "Meetings",
          value: String(metrics.meetings),
          icon: Calendar,
          href: "/dashboard/meetings",
        },
        {
          label: "Proposals",
          value: String(metrics.proposals),
          icon: FileText,
          href: "/dashboard/proposals",
        },
        {
          label: "Deals won",
          value: String(metrics.dealsWon),
          sub: `${metrics.winRate}% win rate · avg ${fmt(metrics.averageDealSize)}`,
          icon: CircleDollarSign,
        },
      ]
    : [];

  const funnelEntries = metrics
    ? Object.entries(metrics.funnel)
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Welcome back, {user.firstName}
        </h2>
        <p className="text-muted-foreground">
          Revenue command center — measure what closes, not just what you send.
          <Badge variant="secondary" className="ml-2">
            {ROLE_LABELS[user.role]}
          </Badge>
        </p>
      </div>

      <SetupChecklist readiness={readiness} />

      {user.organizationId && <DailyRevenueCopilot />}

      {metrics && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {statCards.map((stat) => (
              <Card key={stat.label}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.label}
                  </CardTitle>
                  <stat.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  {stat.sub && (
                    <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
                  )}
                  {stat.href && (
                    <Link href={stat.href}>
                      <Button variant="link" className="px-0 h-auto text-xs">
                        View →
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Revenue funnel</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Opportunities → Qualified → Contacted → Replied → Meeting →
                  Proposal → Negotiation → Won
                </p>
              </div>
              <Link href="/dashboard/analytics">
                <Button variant="outline" size="sm">
                  Full analytics
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
                {funnelEntries.map(([label, count]) => (
                  <div key={label} className="rounded-md border px-3 py-2">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-lg font-semibold">{count}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span>Sales cycle: {metrics.salesCycleDays} days</span>
                <span>Outreach reply rate: {metrics.outreachReplyRate}%</span>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
