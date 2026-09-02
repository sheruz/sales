import prisma from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserReadiness } from "@/lib/integrations/readiness";
import { SetupChecklist } from "@/components/dashboard/setup-checklist";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Briefcase,
  Calendar,
  MessageSquare,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { ROLE_LABELS, isAdmin, isManagerOrAbove } from "@/lib/auth/permissions";
import Link from "next/link";
import { Button } from "@/components/ui/button";

async function getDashboardStats(userId: string, role: string) {
  const scopeFilter =
    isAdmin(role as import("@prisma/client").UserRole) ||
    isManagerOrAbove(role as import("@prisma/client").UserRole)
      ? { deletedAt: null }
      : { deletedAt: null, OR: [{ assignedToId: userId }, { createdById: userId }] };

  const [
    totalLeads,
    hotLeads,
    repliedLeads,
    contactedLeads,
    activeDeals,
    pendingTasks,
  ] = await Promise.all([
    prisma.lead.count({ where: scopeFilter }),
    prisma.lead.count({ where: { ...scopeFilter, scoreCategory: "HOT" } }),
    prisma.lead.count({ where: { ...scopeFilter, status: "REPLIED" } }),
    prisma.lead.count({ where: { ...scopeFilter, status: "CONTACTED" } }),
    prisma.deal.count({
      where: {
        deletedAt: null,
        stage: { notIn: ["WON", "LOST"] },
        ...(isManagerOrAbove(role as import("@prisma/client").UserRole)
          ? {}
          : { assignedToId: userId }),
      },
    }),
    prisma.task.count({
      where: {
        status: "PENDING",
        ...(isManagerOrAbove(role as import("@prisma/client").UserRole)
          ? {}
          : { assignedToId: userId }),
      },
    }),
  ]);

  return { totalLeads, hotLeads, repliedLeads, contactedLeads, activeDeals, pendingTasks };
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [stats, readiness] = await Promise.all([
    getDashboardStats(user.id, user.role),
    getUserReadiness(user.id),
  ]);

  const statCards = [
    { label: "Total Leads", value: stats.totalLeads, icon: Users },
    { label: "Hot Leads", value: stats.hotLeads, icon: TrendingUp, href: "/dashboard/leads?score=HOT" },
    { label: "Contacted", value: stats.contactedLeads, icon: MessageSquare },
    { label: "Replied", value: stats.repliedLeads, icon: MessageSquare },
    { label: "Active Deals", value: stats.activeDeals, icon: Briefcase },
    { label: "Pending Tasks", value: stats.pendingTasks, icon: Target },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Welcome back, {user.firstName}
        </h2>
        <p className="text-muted-foreground">
          Your sales automation command center.
          <Badge variant="secondary" className="ml-2">
            {ROLE_LABELS[user.role]}
          </Badge>
        </p>
      </div>

      <SetupChecklist readiness={readiness} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
              {stat.href && stat.value > 0 && (
                <Link href={stat.href}>
                  <Button variant="link" className="px-0 h-auto text-xs">
                    View hot leads →
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
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Link href="/dashboard/settings?tab=integrations">
              <Button variant="outline" size="sm">Connect integrations</Button>
            </Link>
            <Link href="/dashboard/leads">
              <Button variant="outline" size="sm">View leads</Button>
            </Link>
            <Link href="/dashboard/autopilot">
              <Button variant="outline" size="sm">Run autopilot</Button>
            </Link>
            <Link href="/dashboard/campaigns">
              <Button variant="outline" size="sm">Campaigns</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Workflow</CardTitle>
            <CardDescription>How your SaaS automation works</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            <p>1. Connect your AI + email in Settings</p>
            <p>2. Autopilot finds job-post leads with email</p>
            <p>3. AI writes & sends outreach from your inbox</p>
            <p>4. Track replies in Conversations</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
