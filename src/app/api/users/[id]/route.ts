import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { authService } from "@/services/auth.service";
import { updateUserSchema } from "@/lib/auth/schemas";
import {
  requireOrgPermission,
  requireSuperAdmin,
  requireUser,
} from "@/lib/auth/api-auth";
import { apiSuccess, NotFoundError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function assertOrgMember(organizationId: string, userId: string) {
  const membership = await prisma.organizationUser.findUnique({
    where: {
      organizationId_userId: { organizationId, userId },
    },
  });
  if (!membership) throw new NotFoundError("User not found");
  return membership;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const currentUser = await requireUser();
    const { id } = await params;
    const body = await request.json();
    const input = updateUserSchema.parse(body);

    if (currentUser.isPlatformAdmin) {
      await requireSuperAdmin();
      const updated = await authService.updateUser(id, input, currentUser.role);
      return NextResponse.json(apiSuccess(updated));
    }

    await requireOrgPermission("users.update");
    await assertOrgMember(currentUser.organizationId!, id);
    const updated = await authService.updateUser(id, input, currentUser.role);
    return NextResponse.json(apiSuccess(updated));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const currentUser = await requireUser();
    const { id } = await params;

    if (currentUser.isPlatformAdmin) {
      await requireSuperAdmin();
      await authService.deactivateUser(id, currentUser.id, currentUser.role);
      return NextResponse.json(apiSuccess({ message: "User deactivated" }));
    }

    await requireOrgPermission("users.delete");
    await assertOrgMember(currentUser.organizationId!, id);
    await authService.deactivateUser(id, currentUser.id, currentUser.role);
    return NextResponse.json(apiSuccess({ message: "User deactivated" }));
  } catch (error) {
    return handleApiError(error);
  }
}
