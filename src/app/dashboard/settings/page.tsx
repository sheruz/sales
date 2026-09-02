import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { userIntegrationService } from "@/services/user-integration.service";
import { serviceCatalogService } from "@/services/service-catalog.service";
import { UserManagementPanel } from "@/components/dashboard/user-management-panel";
import { IntegrationsPanel } from "@/components/settings/integrations-panel";
import { ProfileSettings } from "@/components/settings/profile-settings";
import { ServicesPanel } from "@/components/settings/services-panel";
import { AiUsageCard } from "@/components/settings/ai-usage-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const defaultTab =
    params.tab === "integrations"
      ? "integrations"
      : params.tab === "services"
        ? "services"
        : "profile";

  const canManageUsers = hasPermission(user.role, "users:manage");
  const canManageIntegrations = hasPermission(user.role, "integrations:manage");
  const canManageServices = hasPermission(user.role, "settings:write");

  const [integrationData, services] = await Promise.all([
    canManageIntegrations ? userIntegrationService.listForUser(user.id) : null,
    canManageServices ? serviceCatalogService.list() : [],
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">
          Manage your profile, integrations, and company services.
        </p>
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          {canManageIntegrations && (
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
          )}
          {(canManageServices || canManageIntegrations) && (
            <TabsTrigger value="services">Services</TabsTrigger>
          )}
          {canManageUsers && (
            <TabsTrigger value="users">Team</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <ProfileSettings
            user={{
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              role: user.role,
            }}
          />
        </TabsContent>

        {canManageIntegrations && integrationData && (
          <TabsContent value="integrations" className="mt-4 space-y-6">
            <Suspense fallback={null}>
              <IntegrationsPanel initialData={integrationData} />
            </Suspense>
            <AiUsageCard />
          </TabsContent>
        )}

        <TabsContent value="services" className="mt-4">
          {canManageServices ? (
            <ServicesPanel
              initialServices={services.map((s) => ({
                id: s.id,
                name: s.name,
                description: s.description,
                targetClientType: s.targetClientType,
                technologies: s.technologies,
                isActive: s.isActive,
              }))}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Contact your admin to manage company services.
            </p>
          )}
        </TabsContent>

        {canManageUsers && (
          <TabsContent value="users" className="mt-4">
            <UserManagementPanel actorRole={user.role} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
