import { organizationService } from "@/services/organization.service";
import type { PermissionKey } from "@/lib/auth/permission-catalog";
import { OrgTeamClient } from "@/components/dashboard/org-team-client";

interface OrgTeamPanelProps {
  organizationId: string;
  permissions: PermissionKey[];
  currentUserId: string;
}

export async function OrgTeamPanel({
  organizationId,
  permissions,
  currentUserId,
}: OrgTeamPanelProps) {
  const members = await organizationService.listMembers(organizationId);

  return (
    <OrgTeamClient
      members={members.map((m) => ({
        id: m.id,
        status: m.status,
        isPrimaryAdmin: m.isPrimaryAdmin,
        user: {
          id: m.user.id,
          email: m.user.email,
          firstName: m.user.firstName,
          lastName: m.user.lastName,
          isActive: m.user.isActive,
        },
        role: {
          key: m.role.key,
          name: m.role.name,
        },
      }))}
      permissions={permissions}
      currentUserId={currentUserId}
    />
  );
}
