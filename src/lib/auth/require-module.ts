/**
 * B1 API module guard — use on every module route.
 * Lifecycle lock is independent of BILLING_ENFORCEMENT_ENABLED.
 */

import { NextResponse } from "next/server";
import {
  requireAnyOrgPermission,
  requireOrgPermission,
  requireUser,
} from "@/lib/auth/api-auth";
import type { PermissionKey } from "@/lib/auth/permission-catalog";
import { ForbiddenError } from "@/lib/api/response";
import {
  tenantAccessService,
  ACCESS_REASONS,
} from "@/services/tenant-access.service";
import type { ModuleKey } from "@/lib/billing/modules";
import type { AuthUser } from "@/types/auth";

export async function requireModule(
  moduleKey: ModuleKey,
  opts?: {
    permission?: PermissionKey;
    anyOf?: PermissionKey[];
    mutation?: boolean;
  }
): Promise<AuthUser & { organizationId: string }> {
  let user: AuthUser & { organizationId: string };
  if (opts?.anyOf?.length) {
    user = await requireAnyOrgPermission(opts.anyOf);
  } else if (opts?.permission) {
    user = await requireOrgPermission(opts.permission);
  } else {
    const u = await requireUser();
    if (!u.organizationId) {
      throw new ForbiddenError("No active organization");
    }
    user = u as AuthUser & { organizationId: string };
  }

  const result = await tenantAccessService.assertModuleApi(
    user.organizationId,
    moduleKey,
    { mutation: opts?.mutation }
  );
  if (!result.ok) {
    throw new ForbiddenError(result.message, result.reason);
  }
  return user;
}

/** Open billing/account APIs while locked */
export async function requireBillingAccess(): Promise<
  AuthUser & { organizationId: string }
> {
  const user = await requireUser();
  if (!user.organizationId) {
    throw new ForbiddenError("No active organization");
  }
  const access = await tenantAccessService.getAccess(user.organizationId);
  if (
    access.lifecycleEnforced &&
    !access.isPlatformOwner &&
    access.orgStatus === "ARCHIVED"
  ) {
    throw new ForbiddenError("Organization archived", ACCESS_REASONS.ORG_ARCHIVED);
  }
  return user as AuthUser & { organizationId: string };
}

export function moduleForbiddenResponse(err: unknown): NextResponse | null {
  if (err instanceof ForbiddenError && err.code) {
    return NextResponse.json(
      {
        success: false,
        error: { message: err.message, code: err.code, reason: err.code },
      },
      { status: 403 }
    );
  }
  return null;
}
