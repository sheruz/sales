import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { userIntegrationService } from "@/services/user-integration.service";
import { UserManagementPanel } from "@/components/dashboard/user-management-panel";
import { IntegrationsPanel } from "@/components/settings/integrations-panel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const defaultTab = params.tab === "integrations" ? "integrations" : "profile";

  const canManageUsers = hasPermission(user.role, "users:manage");
  const canManageIntegrations = hasPermission(user.role, "integrations:manage");

  const integrationData = canManageIntegrations
    ? await userIntegrationService.listForUser(user.id)
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">
          Connect your own AI, email, and outreach accounts. Credentials are encrypted and never shared.
        </p>
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          {canManageIntegrations && (
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
          )}
          {canManageUsers && (
            <TabsTrigger value="users">User Management</TabsTrigger>
          )}
          <TabsTrigger value="services">Services</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Your Profile</CardTitle>
              <CardDescription>Your account information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="font-medium">Name:</span> {user.firstName}{" "}
                {user.lastName}
              </p>
              <p>
                <span className="font-medium">Email:</span> {user.email}
              </p>
              <p>
                <span className="font-medium">Role:</span> {user.role}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {canManageIntegrations && integrationData && (
          <TabsContent value="integrations" className="mt-4">
            <Suspense fallback={<p>Loading integrations...</p>}>
              <IntegrationsPanel initialData={integrationData} />
            </Suspense>
          </TabsContent>
        )}

        {canManageUsers && (
          <TabsContent value="users" className="mt-4">
            <UserManagementPanel />
          </TabsContent>
        )}

        <TabsContent value="services" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Company Services</CardTitle>
              <CardDescription>
                Services your AI uses when writing outreach. Configure in admin panel (coming soon).
              </CardDescription>
            </CardHeader>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
