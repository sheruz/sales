import { getCurrentUser } from "@/lib/auth/session";
import { UserManagementPanel } from "@/components/dashboard/user-management-panel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PlatformPageHeader } from "@/components/platform/ui/page-header";

export default async function PlatformUsersPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <div className="space-y-6">
      <PlatformPageHeader
        title="Users"
        description="Create company admins for customer accounts, or other platform operators. Company admins manage their sales teams inside the company dashboard."
      />

      <Card>
        <CardHeader>
          <CardTitle>Platform user management</CardTitle>
          <CardDescription>
            Assign <strong>Company Admin</strong> for customers, or{" "}
            <strong>Super Admin</strong> for platform operators only.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserManagementPanel actorRole={user.role} />
        </CardContent>
      </Card>
    </div>
  );
}
