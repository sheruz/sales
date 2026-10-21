import { appOps } from "@/lib/app-paths";
import Link from "next/link";
import { cookies } from "next/headers";
import prisma from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { UserRole } from "@prisma/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Users,
  Zap,
  DollarSign,
  AlertTriangle,
  FileWarning,
  TrendingUp,
  Activity,
} from "lucide-react";
import { env } from "@/lib/config/env";
import { revenueMetricsService } from "@/services/billing/revenue-metrics.service";
import { countConnectedIntegrations } from "@/lib/integrations/connected";
import {
  PLATFORM_BILLING_ENV_COOKIE,
  parsePlatformBillingEnv,
  platformBillingEnvLabel,
} from "@/lib/platform/environment-preference";
import {
  formatMoney,
  formatMoneyShort,
  formatPlatformDate,
  formatSignedMoney,
} from "@/lib/platform/format";
import { platformStatusBadge } from "@/lib/platform/status-badge";
import { RevenueChart } from "@/components/platform/dashboard/revenue-chart";

export default async function PlatformOverviewPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const jar = await cookies();
  const billingEnv = parsePlatformBillingEnv(
    jar.get(PLATFORM_BILLING_ENV_COOKIE)?.value
  );
  const envLabel = platformBillingEnvLabel(billingEnv);

  const metrics = await revenueMetricsService.snapshot(billingEnv);
  const otherEnv =
    billingEnv === "production" ? ("sandbox" as const) : ("production" as const);
  const otherMetrics = await revenueMetricsService.snapshot(otherEnv);

  const [
    organizationCount,
    totalUsers,
    activeUsers,
    connectedIntegrations,
    autopilotEnabled,
    leadsByStatus,
    hotLeads,
    failedAutomation,
  ] = await Promise.all([
    prisma.organization.count({ where: { deletedAt: null } }),
    prisma.user.count({
      where: { deletedAt: null, role: { not: UserRole.SUPER_ADMIN } },
    }),
    prisma.user.count({
      where: {
        deletedAt: null,
        isActive: true,
        role: { not: UserRole.SUPER_ADMIN },
      },
    }),
    countConnectedIntegrations({ excludeOwnerOrg: true }),
    prisma.autopilotConfig.count({
      where: {
        isEnabled: true,
        ...(env.PLATFORM_OWNER_ORG_ID
          ? { organizationId: { not: env.PLATFORM_OWNER_ORG_ID } }
          : {}),
      },
    }),
    prisma.lead.groupBy({
      by: ["status"],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
    prisma.lead.count({ where: { deletedAt: null, scoreCategory: "HOT" } }),
    prisma.lead.count({
      where: { deletedAt: null, automationStatus: "FAILED" },
    }),
  ]);

  const recentOrgs = await prisma.organization.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 6,
  });

  const primaryStats = [
    {
      label: `MRR (${envLabel})`,
      value: formatMoneyShort(metrics.mrr),
      icon: DollarSign,
      href: appOps("/transactions"),
      sub: `${metrics.activeSubscriptions} eligible · MoM ${formatSignedMoney(metrics.mrrChangeVsLastMonth)}`,
    },
    {
      label: "ARR",
      value: formatMoneyShort(metrics.arr),
      icon: TrendingUp,
      sub: `Other env ${formatMoneyShort(otherMetrics.mrr)} MRR`,
    },
    {
      label: "Revenue this month",
      value: formatMoneyShort(metrics.revenueThisMonth),
      icon: DollarSign,
      href: `${appOps("/transactions")}?environment=${billingEnv}`,
      sub: `Last month ${formatMoneyShort(metrics.revenueLastMonth)}`,
    },
    {
      label: "Outstanding invoices",
      value: String(metrics.outstandingManualInvoices),
      icon: FileWarning,
      href: appOps("/invoices"),
      sub: "OPEN + OVERDUE",
    },
    {
      label: "Needs attention",
      value: String(metrics.webhooks.needingAttention),
      icon: AlertTriangle,
      href: appOps("/payments"),
      sub: `${metrics.failedPaymentsNeedingAttention} past due · ${metrics.webhooks.skipped} skipped`,
    },
    {
      label: "Organizations",
      value: String(organizationCount),
      icon: Building2,
      href: appOps("/companies"),
    },
    {
      label: "Customer users",
      value: String(totalUsers),
      icon: Users,
      href: appOps("/users"),
      sub: `${activeUsers} active`,
    },
    {
      label: "Integrations",
      value: String(connectedIntegrations),
      icon: Zap,
      sub: "CONNECTED tenants",
    },
  ];

  const leadTotal = leadsByStatus.reduce(
    (s, r) => s + (r._count._all || 0),
    0
  );

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-2xl font-bold tracking-tight">
            Welcome, {user.firstName}
          </h2>
          <Badge>Super Admin</Badge>
          <Badge
            variant={billingEnv === "sandbox" ? "secondary" : "default"}
          >
            {envLabel}
          </Badge>
        </div>
        <p className="text-muted-foreground">
          Platform control center — metrics follow the Live / Test switch in the
          header.
        </p>
        {env.PAYMENTS_EMERGENCY_DISABLE && (
          <div className="mt-3 rounded-md border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            Payments emergency disable is ON — card checkout forced off.
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {primaryStats.map((stat) => (
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
                <p className="text-xs text-muted-foreground">{stat.sub}</p>
              )}
              {stat.href && (
                <Link href={stat.href}>
                  <Button variant="link" className="mt-1 h-auto px-0 text-xs">
                    View →
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue — last 12 months</CardTitle>
            <CardDescription>
              {envLabel} completed charges (subscription, renewal, top-up,
              manual)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RevenueChart data={metrics.chart12m} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By plan</CardTitle>
            <CardDescription>Eligible MRR mix</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.keys(metrics.mrrByPlan).length === 0 ? (
              <p className="text-sm text-muted-foreground">No eligible MRR</p>
            ) : (
              Object.entries(metrics.mrrByPlan)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 8)
                .map(([plan, mrr]) => (
                  <div
                    key={plan}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="truncate text-muted-foreground">
                      {plan}
                    </span>
                    <span className="font-medium tabular-nums">
                      {formatMoney(mrr)}
                    </span>
                  </div>
                ))
            )}
            <div className="border-t pt-2 text-xs text-muted-foreground">
              Trial→paid: {(metrics.trialToPaidRate * 100).toFixed(0)}% ·
              Autopilot on: {autopilotEnabled}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2" id="activity">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="size-4" />
              Platform activity
            </CardTitle>
            <CardDescription>Lead pipeline snapshot</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total leads</span>
              <span className="font-medium">{leadTotal}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Hot leads</span>
              <span className="font-medium">{hotLeads}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Automation failed</span>
              <span className="font-medium">{failedAutomation}</span>
            </div>
            {leadsByStatus.slice(0, 6).map((row) => (
              <div key={row.status} className="flex justify-between">
                <span className="text-muted-foreground">{row.status}</span>
                <span className="font-medium">{row._count._all}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent organizations</CardTitle>
            <CardDescription>Newest workspaces</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentOrgs.length === 0 ? (
              <p className="text-sm text-muted-foreground">None yet</p>
            ) : (
              recentOrgs.map((org) => {
                const badge = platformStatusBadge(org.status);
                return (
                  <Link
                    key={org.id}
                    href={appOps(`/companies/${org.id}`)}
                    className="flex items-center justify-between rounded border px-3 py-2 text-sm hover:bg-muted"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">{org.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatPlatformDate(org.createdAt)}
                      </div>
                    </div>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </Link>
                );
              })
            )}
            <div className="pt-2">
              <Link href={appOps("/companies")}>
                <Button variant="outline" size="sm">
                  All organizations
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
