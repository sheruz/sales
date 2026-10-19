import { appHome } from "@/lib/app-paths";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { SESSION_COOKIE } from "@/lib/auth/permissions";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { PlatformSidebar } from "@/components/platform/platform-sidebar";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { BillingKillSwitchBanner } from "@/components/platform/billing-kill-switch-banner";

export const dynamic = "force-dynamic";

export default async function PlatformLayout({
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
      // ignore — login page still reachable after middleware fix
    }
    redirect("/login");
  }

  if (!user.isPlatformAdmin) {
    redirect(appHome());
  }

  const jar = await cookies();
  const defaultOpen = jar.get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <PlatformSidebar user={user} />
      <SidebarInset>
        <BillingKillSwitchBanner />
        <DashboardHeader user={user} title="Platform" />
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
