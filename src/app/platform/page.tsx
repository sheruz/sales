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
import { Building2, Users, Target, MessageSquare, Zap } from "lucide-react";

function statusVariant(status: string) {
  if (status === "ACTIVE") return "default" as const;
  if (status === "SUSPENDED") return "destructive" as const;
  return "secondary" as const;
}

export default async function PlatformOverviewPage() {
  const user = await getCurrentUser();
  if (!user) return null;

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
    prisma.userIntegration.count({ where: { isConnected: true } }),
    prisma.autopilotConfig.count({ where: { isEnabled: true } }),
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
      label: "Organizations",
      value: organizationCount,
      icon: Building2,
      href: "/platform/companies",
    },
    {
      label: "Customer users",
      value: totalUsers,
      icon: Users,
      href: "/platform/users",
      sub: `${activeUsers} active`,
    },
    { label: "Leads (platform)", value: totalLeads, icon: Target },
    { label: "Campaigns", value: totalCampaigns, icon: MessageSquare },
    { label: "Connected integrations", value: connectedIntegrations, icon: Zap },
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
          Platform control center — manage organizations and monitor SaaS usage.
          This is separate from each company&apos;s sales dashboard.
        </p>
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
              <div className="text-2xl font-bold">{stat.value}</div>
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
            <Link href="/platform/companies">
              <Button variant="outline" size="sm">
                Manage organizations
              </Button>
            </Link>
            <Link href="/platform/users">
              <Button variant="outline" size="sm">
                All users
              </Button>
            </Link>
            <Link href="/platform/activity">
              <Button variant="outline" size="sm">
                View activity
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent organizations</CardTitle>
            <CardDescription>Latest customer tenants</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentOrgs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No organizations yet. Create one under Organizations.
              </p>
            ) : (
              recentOrgs.map((org) => (
                <div
                  key={org.id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/platform/companies/${org.id}`}
                      className="font-medium truncate hover:underline block"
                    >
                      {org.name}
                    </Link>
                    <p className="text-xs text-muted-foreground truncate font-mono">
                      {org.slug}
                    </p>
                  </div>
                  <Badge variant={statusVariant(org.status)}>{org.status}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
