import { getCurrentUser } from "@/lib/auth/session";
import { UserManagementPanel } from "@/components/dashboard/user-management-panel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function PlatformUsersPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">All Users</h2>
        <p className="text-muted-foreground">
          Create company admins for customer accounts, or other platform operators.
          Company admins then manage their own sales teams inside the company dashboard.
        </p>
      </div>

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
