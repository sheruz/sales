import prisma from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";
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
import { ROLE_LABELS } from "@/lib/auth/permissions";

async function getDashboardStats() {
  const [
    totalLeads,
    newLeads,
    qualifiedLeads,
    contactedLeads,
    repliedLeads,
    activeDeals,
    wonDeals,
    lostDeals,
    upcomingMeetings,
    pendingTasks,
  ] = await Promise.all([
    prisma.lead.count({ where: { deletedAt: null } }),
    prisma.lead.count({ where: { deletedAt: null, status: "NEW" } }),
    prisma.lead.count({ where: { deletedAt: null, status: "QUALIFIED" } }),
    prisma.lead.count({ where: { deletedAt: null, status: "CONTACTED" } }),
    prisma.lead.count({ where: { deletedAt: null, status: "REPLIED" } }),
    prisma.deal.count({
      where: {
        deletedAt: null,
        stage: { notIn: ["WON", "LOST"] },
      },
    }),
    prisma.deal.count({ where: { deletedAt: null, stage: "WON" } }),
    prisma.deal.count({ where: { deletedAt: null, stage: "LOST" } }),
    prisma.meeting.count({
      where: {
        date: { gte: new Date() },
        outcome: "SCHEDULED",
      },
    }),
    prisma.task.count({ where: { status: "PENDING" } }),
  ]);

  const pipelineValue = await prisma.deal.aggregate({
    where: {
      deletedAt: null,
      stage: { notIn: ["WON", "LOST"] },
    },
    _sum: { estimatedValue: true },
  });

  return {
    totalLeads,
    newLeads,
    qualifiedLeads,
    contactedLeads,
    repliedLeads,
    activeDeals,
    wonDeals,
    lostDeals,
    upcomingMeetings,
    pendingTasks,
    pipelineValue: Number(pipelineValue._sum.estimatedValue ?? 0),
  };
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const stats = await getDashboardStats();

  const statCards = [
    { label: "Total Leads", value: stats.totalLeads, icon: Users },
    { label: "New Leads", value: stats.newLeads, icon: TrendingUp },
    { label: "Qualified", value: stats.qualifiedLeads, icon: Target },
    { label: "Contacted", value: stats.contactedLeads, icon: MessageSquare },
    { label: "Replied", value: stats.repliedLeads, icon: MessageSquare },
    { label: "Active Deals", value: stats.activeDeals, icon: Briefcase },
    { label: "Won Deals", value: stats.wonDeals, icon: Briefcase },
    { label: "Lost Deals", value: stats.lostDeals, icon: Briefcase },
    {
      label: "Pipeline Value",
      value: `$${stats.pipelineValue.toLocaleString()}`,
      icon: TrendingUp,
    },
    { label: "Upcoming Meetings", value: stats.upcomingMeetings, icon: Calendar },
    { label: "Pending Tasks", value: stats.pendingTasks, icon: Target },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Welcome back, {user?.firstName}
        </h2>
        <p className="text-muted-foreground">
          Here&apos;s an overview of your sales pipeline.
          {user && (
            <Badge variant="secondary" className="ml-2">
              {ROLE_LABELS[user.role]}
            </Badge>
          )}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks to get started</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• Add your first lead from the Leads section</p>
            <p>• Create a campaign to organize outreach</p>
            <p>• Configure company services in Settings</p>
            <p>• Set up your email account for outreach</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
            <CardDescription>Your sales workflow</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Lead Discovery → Research → Qualification</p>
            <p>→ Personalized Outreach → Reply Management</p>
            <p>→ Follow-ups → Meeting → Proposal → Won/Lost</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
