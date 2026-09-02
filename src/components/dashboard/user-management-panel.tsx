import { authService } from "@/services/auth.service";
import { UserManagement } from "@/components/dashboard/user-management";
import type { UserRole } from "@prisma/client";

export async function UserManagementPanel({
  actorRole,
}: {
  actorRole?: UserRole;
}) {
  const users = await authService.listUsers();
  return <UserManagement initialUsers={users} actorRole={actorRole} />;
}
