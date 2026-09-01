import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { UserManagementPanel } from "@/components/dashboard/user-management-panel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const canManageUsers = hasPermission(user.role, "users:manage");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">
          Manage your account and platform configuration.
        </p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          {canManageUsers && (
            <TabsTrigger value="users">User Management</TabsTrigger>
          )}
          <TabsTrigger value="services">Services</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Your Profile</CardTitle>
              <CardDescription>Your account information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="font-medium">Name:</span> {user.firstName}{" "}
                {user.lastName}
              </p>
              <p>
                <span className="font-medium">Email:</span> {user.email}
              </p>
              <p>
                <span className="font-medium">Role:</span> {user.role}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {canManageUsers && (
          <TabsContent value="users" className="mt-4">
            <UserManagementPanel />
          </TabsContent>
        )}

        <TabsContent value="services" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Company Services</CardTitle>
              <CardDescription>
                Configure services for AI outreach generation. Available in a
                future update.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Service configuration will be available in Phase 5.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
