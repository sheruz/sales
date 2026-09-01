import { authService } from "@/services/auth.service";
import { UserManagement } from "@/components/dashboard/user-management";

export async function UserManagementPanel() {
  const users = await authService.listUsers();
  return <UserManagement initialUsers={users} />;
}
