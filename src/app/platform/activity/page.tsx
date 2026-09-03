import prisma from "@/lib/db/prisma";
import { UserRole } from "@prisma/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function PlatformActivityPage() {
  const [
    leadsByStatus,
    hotLeads,
    outboundMessages,
    failedAutomation,
    managers,
    reps,
    openaiConnected,
    emailConnected,
  ] = await Promise.all([
    prisma.lead.groupBy({
      by: ["status"],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
    prisma.lead.count({ where: { deletedAt: null, scoreCategory: "HOT" } }),
    prisma.conversation.count({ where: { isInbound: false } }),
    prisma.lead.count({
      where: { deletedAt: null, automationStatus: "FAILED" },
    }),
    prisma.user.count({
      where: { deletedAt: null, role: UserRole.SALES_MANAGER, isActive: true },
    }),
    prisma.user.count({
      where: {
        deletedAt: null,
        role: UserRole.SALES_REPRESENTATIVE,
        isActive: true,
      },
    }),
    prisma.userIntegration.count({
      where: { platform: "OPENAI", isConnected: true },
    }),
    prisma.userIntegration.count({
      where: { platform: "EMAIL_SMTP", isConnected: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Platform Activity</h2>
        <p className="text-muted-foreground">
          Cross-company usage snapshot for the SaaS platform.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Hot leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{hotLeads}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Failed automations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{failedAutomation}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              OpenAI connected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openaiConnected}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Email connected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{emailConnected}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Leads by status</CardTitle>
            <CardDescription>All companies combined</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {leadsByStatus.length === 0 ? (
              <p className="text-muted-foreground">No leads yet.</p>
            ) : (
              leadsByStatus
                .sort((a, b) => b._count._all - a._count._all)
                .map((row) => (
                  <div key={row.status} className="flex justify-between">
                    <span>{row.status}</span>
                    <span className="font-medium">{row._count._all}</span>
                  </div>
                ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Team roles</CardTitle>
            <CardDescription>Customer seats (excludes super admins)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Sales Managers</span>
              <span className="font-medium">{managers}</span>
            </div>
            <div className="flex justify-between">
              <span>Sales Representatives</span>
              <span className="font-medium">{reps}</span>
            </div>
            <div className="flex justify-between pt-2 text-muted-foreground">
              <span>Outbound messages</span>
              <span className="font-medium">{outboundMessages}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
