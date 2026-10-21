import { appHome } from "@/lib/app-paths";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { SESSION_COOKIE } from "@/lib/auth/permissions";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { PlatformSidebar } from "@/components/platform/platform-sidebar";
import { PlatformHeader } from "@/components/platform/platform-header";
import { PlatformEnvBanner } from "@/components/platform/platform-env-banner";
import { BillingKillSwitchBanner } from "@/components/platform/billing-kill-switch-banner";
import {
  PLATFORM_BILLING_ENV_COOKIE,
  parsePlatformBillingEnv,
} from "@/lib/platform/environment-preference";

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

  if (!user.isPlatformOperator && !user.isPlatformAdmin) {
    redirect(appHome());
  }

  const jar = await cookies();
  const defaultOpen = jar.get("sidebar_state")?.value !== "false";
  const billingEnv = parsePlatformBillingEnv(
    jar.get(PLATFORM_BILLING_ENV_COOKIE)?.value
  );

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <PlatformSidebar user={user} />
      <SidebarInset>
        <BillingKillSwitchBanner />
        <PlatformEnvBanner billingEnv={billingEnv} />
        <PlatformHeader user={user} billingEnv={billingEnv} />
        <main className="mx-auto w-full max-w-[1400px] flex-1 overflow-auto p-4 md:p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
