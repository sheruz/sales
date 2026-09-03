import { UserRole } from "@prisma/client";
import type { PermissionKey } from "@/lib/auth/permission-catalog";

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  /** Legacy UserRole — kept for compatibility */
  role: UserRole;
  avatarUrl: string | null;
  /** True when User.role === SUPER_ADMIN */
  isPlatformAdmin: boolean;
  /** Active organization for this session (null for platform-only) */
  organizationId: string | null;
  organizationName: string | null;
  organizationSlug: string | null;
  /** Membership role key e.g. company_admin */
  organizationRoleKey: string | null;
  permissions: PermissionKey[];
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface CreateUserInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  role?: UserRole;
  isActive?: boolean;
}
