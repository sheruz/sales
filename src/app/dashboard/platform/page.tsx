import { redirect } from "next/navigation";
import prisma from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { UserManagementPanel } from "@/components/dashboard/user-management-panel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserRole } from "@prisma/client";

export default async function PlatformAdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user.role, "platform:manage")) redirect("/dashboard");

  const [totalUsers, activeUsers, superAdmins, companyAdmins, totalLeads, totalCampaigns] =
    await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { deletedAt: null, isActive: true } }),
      prisma.user.count({ where: { deletedAt: null, role: UserRole.SUPER_ADMIN, isActive: true } }),
      prisma.user.count({ where: { deletedAt: null, role: UserRole.ADMIN, isActive: true } }),
      prisma.lead.count({ where: { deletedAt: null } }),
      prisma.campaign.count({ where: { deletedAt: null } }),
    ]);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold tracking-tight">Platform Admin</h2>
          <Badge variant="secondary">Super Admin</Badge>
        </div>
        <p className="text-muted-foreground">
          Manage the SaaS platform, all accounts, and company admins. Customer companies use{" "}
          <strong>Company Admin</strong> for their own teams.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsers}</div>
            <p className="text-xs text-muted-foreground">{activeUsers} active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Company admins
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{companyAdmins}</div>
            <p className="text-xs text-muted-foreground">Customer org owners</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Super admins
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{superAdmins}</div>
            <p className="text-xs text-muted-foreground">Platform operators</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Leads (all)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLeads}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Campaigns (all)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCampaigns}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Role model</CardTitle>
          <CardDescription>How access works in this SaaS product</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Super Admin</strong> — You (platform owner).
            Full access + this page. Can create other super admins and company admins.
          </p>
          <p>
            <strong className="text-foreground">Company Admin</strong> — Your customer&apos;s
            account owner. Manages their team, integrations, services, and autopilot.
          </p>
          <p>
            <strong className="text-foreground">Sales Manager / Rep</strong> — Team members
            inside a customer company.
          </p>
          <p className="pt-2 text-xs">
            Multi-tenant workspaces (separate companies with isolated data) can be added next.
            Today all users share one database; roles control who can manage whom.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All users</CardTitle>
          <CardDescription>Create company admins and manage every account on the platform</CardDescription>
        </CardHeader>
        <CardContent>
          <UserManagementPanel actorRole={user.role} />
        </CardContent>
      </Card>
    </div>
  );
}
