import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { isSuperAdmin, SESSION_COOKIE } from "@/lib/auth/permissions";
import { getFeatureFlags } from "@/lib/features/flags";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { getAutopilotShellStatus } from "@/lib/autopilot/shell-status";
import { hasOrgPermission } from "@/lib/tenant/scope";
import prisma from "@/lib/db/prisma";
export const dynamic = "force-dynamic";

/** Real badge counts for the sidebar. Failures degrade to no badge. */
async function getNavCounts(
  organizationId: string | null | undefined,
  allow: { inbox: boolean; outreach: boolean }
): Promise<Record<string, number>> {
  if (!organizationId) return {};
  const [inbox, outreach] = await Promise.all([
    allow.inbox
      ? prisma.inboxConversation
          .count({ where: { organizationId, status: "NEEDS_ACTION" } })
          .catch(() => 0)
      : 0,
    allow.outreach
      ? prisma.pitch
          .count({ where: { organizationId, status: "DRAFT" } })
          .catch(() => 0)
      : 0,
  ]);
  return { Inbox: inbox, Outreach: outreach };
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    try {
      const jar = await cookies();
      jar.delete(SESSION_COOKIE);
    } catch {
      // ignore
    }
    redirect("/login");
  }

  if (isSuperAdmin(user.role)) {
    redirect("/platform");
  }

  const jar = await cookies();
  const sidebarCookie = jar.get("sidebar_state")?.value;
  const defaultOpen = sidebarCookie !== "false";
  const flags = await getFeatureFlags(user.organizationId);

  const autopilotStatus = user.organizationId
    ? await getAutopilotShellStatus(user.organizationId)
    : {
        tone: "warn" as const,
        label: "Paused",
        lastRunAt: null,
        minutesAgo: null,
      };

  const navCounts = await getNavCounts(user.organizationId, {
    inbox: hasOrgPermission(user, "conversations.view"),
    outreach:
      hasOrgPermission(user, "campaigns.view") ||
      hasOrgPermission(user, "campaigns.manage"),
  });

  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      className="min-h-svh bg-background"
    >
      <AppSidebar
        user={user}
        flags={flags}
        autopilotStatus={autopilotStatus}
        navCounts={navCounts}
      />
      <SidebarInset className="min-h-svh min-w-0 overflow-hidden">
        <DashboardHeader user={user} />
        <div className="dx w-full min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
