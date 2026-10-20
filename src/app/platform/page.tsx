import { appOps } from "@/lib/app-paths";
import Link from "next/link";
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
  Target,
  MessageSquare,
  Zap,
  DollarSign,
  AlertTriangle,
  FileWarning,
} from "lucide-react";
import { env } from "@/lib/config/env";
import { revenueMetricsService } from "@/services/billing/revenue-metrics.service";
import { countConnectedIntegrations } from "@/lib/integrations/connected";

function statusVariant(status: string) {
  if (status === "ACTIVE") return "default" as const;
  if (status === "SUSPENDED") return "destructive" as const;
  return "secondary" as const;
}

function money(n: number) {
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export default async function PlatformOverviewPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  // B4a: Live metrics by default (B4b adds Live|Test switch)
  const metrics = await revenueMetricsService.snapshot("production");
  const testMetrics = await revenueMetricsService.snapshot("sandbox");

  const [
    organizationCount,
    totalUsers,
    activeUsers,
    totalLeads,
    totalCampaigns,
    connectedIntegrations,
    autopilotEnabled,
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
    prisma.lead.count({ where: { deletedAt: null } }),
    prisma.campaign.count({ where: { deletedAt: null } }),
    countConnectedIntegrations({ excludeOwnerOrg: true }),
    prisma.autopilotConfig.count({
      where: {
        isEnabled: true,
        ...(env.PLATFORM_OWNER_ORG_ID
          ? { organizationId: { not: env.PLATFORM_OWNER_ORG_ID } }
          : {}),
      },
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
    take: 5,
  });

  const stats = [
    {
      label: "MRR (Live)",
      value: money(metrics.mrr),
      icon: DollarSign,
      href: appOps("/revenue"),
      sub: `${metrics.activeSubscriptions} eligible · Test MRR ${money(testMetrics.mrr)}`,
    },
    {
      label: "Revenue this month (Live)",
      value: money(metrics.revenueThisMonth),
      icon: DollarSign,
      href: appOps("/transactions"),
      sub: `Last month ${money(metrics.revenueLastMonth)}`,
    },
    {
      label: "Outstanding invoices",
      value: metrics.outstandingManualInvoices,
      icon: FileWarning,
      href: appOps("/invoices"),
      sub: "OPEN + OVERDUE",
    },
    {
      label: "Failed / unmatched",
      value: metrics.webhooks.needingAttention,
      icon: AlertTriangle,
      href: appOps("/payments"),
      sub: `${metrics.failedPaymentsNeedingAttention} past due · ${metrics.webhooks.skipped} skipped`,
    },
    {
      label: "Organizations",
      value: organizationCount,
      icon: Building2,
      href: appOps("/companies"),
    },
    {
      label: "Customer users",
      value: totalUsers,
      icon: Users,
      href: appOps("/users"),
      sub: `${activeUsers} active`,
    },
    { label: "Leads (platform)", value: totalLeads, icon: Target },
    { label: "Campaigns", value: totalCampaigns, icon: MessageSquare },
    {
      label: "Connected integrations",
      value: connectedIntegrations,
      icon: Zap,
      sub: "TenantIntegration CONNECTED",
    },
    { label: "Autopilot enabled", value: autopilotEnabled, icon: Zap },
  ];

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold tracking-tight">
            Welcome, {user.firstName}
          </h2>
          <Badge>Super Admin</Badge>
        </div>
        <p className="text-muted-foreground">
          Platform control center — manage organizations and monitor usage.
        </p>
        {env.PAYMENTS_EMERGENCY_DISABLE && (
          <div className="mt-3 rounded-md border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            Payments emergency disable is ON — card checkout forced off.
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{String(stat.value)}</div>
              {stat.sub && (
                <p className="text-xs text-muted-foreground">{stat.sub}</p>
              )}
              {stat.href && (
                <Link href={stat.href}>
                  <Button variant="link" className="px-0 h-auto text-xs mt-1">
                    View →
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
            <CardDescription>Platform operations</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Link href={appOps("/companies")}>
              <Button variant="outline" size="sm">
                Manage organizations
              </Button>
            </Link>
            <Link href={appOps("/packages")}>
              <Button variant="outline" size="sm">
                Packages
              </Button>
            </Link>
            <Link href={appOps("/payments")}>
              <Button variant="outline" size="sm">
                Payments
              </Button>
            </Link>
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
              recentOrgs.map((org) => (
                <Link
                  key={org.id}
                  href={appOps(`/companies/${org.id}`)}
                  className="flex items-center justify-between rounded border px-3 py-2 text-sm hover:bg-muted"
                >
                  <span className="font-medium">{org.name}</span>
                  <Badge variant={statusVariant(org.status)}>{org.status}</Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
