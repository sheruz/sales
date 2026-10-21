import { getCurrentUser } from "@/lib/auth/session";
import { ProfileSettings } from "@/components/settings/profile-settings";
import { EmailBrandingPanel } from "@/components/settings/email-branding-panel";
import { MfaSettingsPanel } from "@/components/platform/mfa-settings-panel";
import { PlatformPageHeader } from "@/components/platform/ui/page-header";
import Link from "next/link";
import { appOps } from "@/lib/app-paths";

export default async function PlatformSettingsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <div className="space-y-8">
      <PlatformPageHeader
        title="Platform Settings"
        description="Profile, two-factor authentication, and system email branding for tenant notices. Seller alert emails live under Payments → Checkout."
      />
      <p className="text-sm text-muted-foreground -mt-4">
        <Link href={appOps("/payments")} className="underline">
          Open Payments
        </Link>{" "}
        to edit seller alert recipients.
      </p>
      <ProfileSettings
        user={{
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
        }}
      />
      <MfaSettingsPanel />
      <div>
        <h3 className="mb-3 text-lg font-semibold">System email branding</h3>
        <EmailBrandingPanel
          mode="platform"
          apiBase="/api/platform/email-branding"
        />
      </div>
    </div>
  );
}
