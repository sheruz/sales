import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { isSuperAdmin, SESSION_COOKIE } from "@/lib/auth/permissions";
import { getFeatureFlags } from "@/lib/features/flags";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { getAutopilotShellStatus } from "@/lib/autopilot/shell-status";

export const dynamic = "force-dynamic";

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

  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      className="min-h-svh bg-background"
    >
      <AppSidebar
        user={user}
        flags={flags}
        autopilotStatus={autopilotStatus}
      />
      <SidebarInset className="min-h-svh">
        <DashboardHeader user={user} />
        <div className="mx-auto w-full max-w-[1280px] flex-1 overflow-auto p-4 md:p-7">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
