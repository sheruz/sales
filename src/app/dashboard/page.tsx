import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserReadiness } from "@/lib/integrations/readiness";
import { hasOrgPermission } from "@/lib/tenant/scope";
import { analyticsService } from "@/services/analytics.service";
import { SetupChecklist } from "@/components/dashboard/setup-checklist";
import { DailyRevenueCopilot } from "@/components/dashboard/daily-revenue-copilot";
import { AnalyticsClient } from "@/components/dashboard/analytics-client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Bot,
  Briefcase,
  CircleDollarSign,
  Flame,
  MessageSquare,
  Target,
} from "lucide-react";
import { ROLE_LABELS } from "@/lib/auth/permissions";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const canAnalytics = hasOrgPermission(user, "analytics.view");
  const canAgent = hasOrgPermission(user, "agent.view");
  const canManageAgent = hasOrgPermission(user, "agent.manage");

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

  const homeStats = metrics
    ? [
        {
          label: "Revenue vs target",
          value: fmt(metrics.revenueAchieved),
          sub:
            metrics.revenueProgress != null
              ? `${metrics.revenueProgress}% of ${fmt(metrics.revenueTarget)}`
              : `Target ${fmt(metrics.revenueTarget)}`,
          icon: CircleDollarSign,
          href: "/dashboard/revenue-goals",
        },
        {
          label: "Open opportunities",
          value: String(metrics.opportunities),
          sub: `${metrics.qualifiedOpportunities} qualified`,
          icon: Flame,
          href: "/dashboard/opportunities",
        },
        {
          label: "Pipeline",
          value: fmt(metrics.pipelineValue),
          sub: `Weighted ${fmt(metrics.weightedPipeline)}`,
          icon: Briefcase,
          href: "/dashboard/pipeline",
        },
        {
          label: "Deals won",
          value: String(metrics.dealsWon),
          sub: `${metrics.winRate}% win rate`,
          icon: Target,
          href: "/dashboard/pipeline",
        },
      ]
    : [];

  const shortcuts = [
    {
      title: "Opportunities",
      href: "/dashboard/opportunities",
      desc: "Work today’s pipeline",
      icon: Flame,
      show: hasOrgPermission(user, "opportunities.view"),
    },
    {
      title: "Inbox",
      href: "/dashboard/conversations",
      desc: "Replies and outreach",
      icon: MessageSquare,
      show: hasOrgPermission(user, "conversations.view"),
    },
    {
      title: "Revenue Agent",
      href: "/dashboard/agent",
      desc: canManageAgent
        ? "Run & approve autonomous actions"
        : "View agent activity",
      icon: Bot,
      show: canAgent,
    },
  ].filter((s) => s.show);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Welcome back, {user.firstName}
        </h2>
        <p className="text-muted-foreground">
          Overview of revenue, pipeline, and what to do next.
          <Badge variant="secondary" className="ml-2">
            {user.organizationRoleKey
              ? user.organizationRoleKey.replace(/_/g, " ")
              : ROLE_LABELS[user.role]}
          </Badge>
        </p>
      </div>

      <SetupChecklist readiness={readiness} />

      {metrics && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {homeStats.map((stat) => (
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
                  <p className="mt-1 text-xs text-muted-foreground">{stat.sub}</p>
                )}
                {stat.href && (
                  <Link href={stat.href}>
                    <Button variant="link" className="h-auto px-0 text-xs">
                      Open →
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {shortcuts.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shortcuts.map((s) => (
            <Link key={s.href} href={s.href}>
              <Card className="h-full transition-colors hover:bg-muted/40">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <s.icon className="h-4 w-4" />
                    {s.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">{s.desc}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {user.organizationId && <DailyRevenueCopilot />}

      {canAnalytics && user.organizationId && (
        <div className="space-y-4 border-t pt-6">
          <div>
            <h3 className="text-lg font-semibold tracking-tight">Analytics</h3>
            <p className="text-sm text-muted-foreground">
              Funnel, sources, services, conversions, and learning insights.
            </p>
          </div>
          <AnalyticsClient />
        </div>
      )}
    </div>
  );
}
