import { getCurrentUser } from "@/lib/auth/session";
import { ProfileSettings } from "@/components/settings/profile-settings";
import { EmailBrandingPanel } from "@/components/settings/email-branding-panel";

export default async function PlatformSettingsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Platform Settings</h2>
        <p className="text-muted-foreground">
          Super Admin profile and platform system-email branding (welcome,
          invoices, payment notices).
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
