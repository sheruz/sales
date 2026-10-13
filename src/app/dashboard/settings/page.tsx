import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { hasOrgPermission } from "@/lib/tenant/scope";
import { userIntegrationService } from "@/services/user-integration.service";
import { serviceCatalogService } from "@/services/service-catalog.service";
import { UserManagementPanel } from "@/components/dashboard/user-management-panel";
import { OrgTeamPanel } from "@/components/dashboard/org-team-panel";
import { IntegrationsPanel } from "@/components/settings/integrations-panel";
import { ProfileSettings } from "@/components/settings/profile-settings";
import { ServicesPanel } from "@/components/settings/services-panel";
import { AiUsageCard } from "@/components/settings/ai-usage-card";
import { BillingPanel } from "@/components/settings/billing-panel";
import { EmailBrandingPanel } from "@/components/settings/email-branding-panel";

type SettingsTab =
  | "profile"
  | "billing"
  | "integrations"
  | "services"
  | "users"
  | "email-branding";

type NavLink = {
  label: string;
  href: string;
  /** Settings panel this link opens on this page (drives the active state). */
  tab?: SettingsTab;
};

type NavGroup = { title: string; links: NavLink[] };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const params = await searchParams;

  const canManageUsers = hasPermission(user.role, "users:manage");
  const canManageIntegrations = hasPermission(user.role, "integrations:manage");
  const canManageServices = hasPermission(user.role, "settings:write");
  const canManageBilling = hasOrgPermission(user, "billing.manage");
  const canBrain = hasOrgPermission(user, "business_brain.manage");
  const canRevenue =
    hasOrgPermission(user, "revenue_goals.manage") ||
    hasOrgPermission(user, "revenue.view");
  const canBranding = canManageIntegrations || canManageServices;

  const allowedTabs: Record<SettingsTab, boolean> = {
    profile: true,
    billing: canManageBilling,
    integrations: canManageIntegrations,
    services: canManageServices || canManageIntegrations,
    users: canManageUsers,
    "email-branding": canBranding,
  };

  const requested = params.tab as SettingsTab | undefined;
  const activeTab: SettingsTab =
    requested && requested in allowedTabs && allowedTabs[requested]
      ? requested
      : "profile";

  const [integrationData, services] = await Promise.all([
    canManageIntegrations && user.organizationId
      ? userIntegrationService.listForUser(user.organizationId, user.id)
      : null,
    canManageServices && user.organizationId
      ? serviceCatalogService.list(user.organizationId)
      : [],
  ]);

  const groups: NavGroup[] = [
    {
      title: "Your business",
      links: [
        ...(canBrain
          ? [
              {
                label: "Business profile",
                href: "/dashboard/business-brain",
              },
              {
                label: "Services",
                href: "/dashboard/services",
                tab: "services" as const,
              },
              {
                label: "Case studies",
                href: "/dashboard/business-brain#documents",
              },
              { label: "Target customers", href: "/dashboard/icp" },
            ]
          : allowedTabs.services
            ? [
                {
                  label: "Services",
                  href: "/dashboard/settings?tab=services",
                  tab: "services" as const,
                },
              ]
            : []),
        ...(canRevenue
          ? [{ label: "Revenue goal", href: "/dashboard/revenue-goals" }]
          : []),
      ],
    },
    {
      title: "Sending",
      links: [
        ...(canBranding
          ? [
              {
                label: "Email & branding",
                href: "/dashboard/settings?tab=email-branding",
                tab: "email-branding" as const,
              },
            ]
          : []),
        ...(canManageIntegrations
          ? [
              {
                label: "Mailboxes",
                href: "/dashboard/outreach?tab=mailboxes",
              },
            ]
          : []),
      ],
    },
    {
      title: "Workspace",
      links: [
        ...(canManageIntegrations
          ? [
              {
                label: "Integrations",
                href: "/dashboard/settings?tab=integrations",
                tab: "integrations" as const,
              },
            ]
          : []),
        ...(canManageUsers
          ? [
              {
                label: "Team",
                href: "/dashboard/settings?tab=users",
                tab: "users" as const,
              },
            ]
          : []),
        ...(canManageBilling
          ? [
              {
                label: "Billing",
                href: "/dashboard/settings?tab=billing",
                tab: "billing" as const,
              },
            ]
          : []),
        {
          label: "My account",
          href: "/dashboard/settings?tab=profile",
          tab: "profile" as const,
        },
      ],
    },
  ].filter((g) => g.links.length > 0);

  return (
    <div className="dx">
      <div className="page">
        <div className="page-head">
          <div>
            <h1 className="page-title">Settings</h1>
            <p className="page-sub">
              Set these once. Autopilot uses them for every lead and email.
            </p>
          </div>
        </div>

        <div className="settings">
          <nav className="settings-nav" aria-label="Settings sections">
            {groups.map((group) => (
              <div key={group.title}>
                <div className="grp">{group.title}</div>
                {group.links.map((link) => {
                  const isActive = link.tab === activeTab;
                  return (
                    <Link
                      key={link.label}
                      href={link.href}
                      className={isActive ? "active" : undefined}
                      aria-current={isActive ? "page" : undefined}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className="settings-panel">
            {activeTab === "profile" && (
              <ProfileSettings
                user={{
                  firstName: user.firstName,
                  lastName: user.lastName,
                  email: user.email,
                  role: user.role,
                }}
              />
            )}

            {activeTab === "billing" && canManageBilling && <BillingPanel />}

            {activeTab === "integrations" &&
              canManageIntegrations &&
              integrationData && (
                <div className="stack">
                  <Suspense fallback={null}>
                    <IntegrationsPanel initialData={integrationData} />
                  </Suspense>
                  <AiUsageCard />
                </div>
              )}

            {activeTab === "services" && (
              <div className="stack">
                {canManageServices ? (
                  <>
                    <p className="muted">
                      Quick edit shortcut. For the full Delvix catalog use{" "}
                      <Link
                        href="/dashboard/services"
                        className="underline underline-offset-2"
                      >
                        Services
                      </Link>
                      .
                    </p>
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
                  </>
                ) : (
                  <p className="muted">
                    Contact your admin to manage company services.
                  </p>
                )}
              </div>
            )}

            {activeTab === "users" &&
              canManageUsers &&
              (user.organizationId ? (
                <OrgTeamPanel
                  organizationId={user.organizationId}
                  permissions={user.permissions}
                  currentUserId={user.id}
                />
              ) : (
                <UserManagementPanel actorRole={user.role} />
              ))}

            {activeTab === "email-branding" && canBranding && (
              <EmailBrandingPanel />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
