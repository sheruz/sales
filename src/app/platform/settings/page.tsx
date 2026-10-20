import { getCurrentUser } from "@/lib/auth/session";
import { ProfileSettings } from "@/components/settings/profile-settings";
import { EmailBrandingPanel } from "@/components/settings/email-branding-panel";
import { MfaSettingsPanel } from "@/components/platform/mfa-settings-panel";

export default async function PlatformSettingsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Platform Settings</h2>
        <p className="text-muted-foreground">
          Super Admin profile, two-factor authentication, and system email
          branding for tenant notices.
        </p>
      </div>
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
        <h3 className="text-lg font-semibold mb-3">System email branding</h3>
        <EmailBrandingPanel
          mode="platform"
          apiBase="/api/platform/email-branding"
        />
      </div>
    </div>
  );
}
