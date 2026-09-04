import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { isSuperAdmin, SESSION_COOKIE } from "@/lib/auth/permissions";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    // Drop stale cookie so middleware/login cannot loop on an invalid session
    try {
      const jar = await cookies();
      jar.delete(SESSION_COOKIE);
    } catch {
      // Cookie mutation may be restricted in some render paths; login still works
    }
    redirect("/login");
  }

  // Super Admin uses the separate platform console — not the company sales app
  if (isSuperAdmin(user.role)) {
    redirect("/platform");
  }

  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      <SidebarInset>
        <DashboardHeader user={user} />
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
