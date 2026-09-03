import { getCurrentUser } from "@/lib/auth/session";
import { ProfileSettings } from "@/components/settings/profile-settings";

export default async function PlatformSettingsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Platform Settings</h2>
        <p className="text-muted-foreground">
          Your Super Admin profile. Company integrations and sales settings live in each
          company&apos;s own dashboard.
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
    </div>
  );
}
