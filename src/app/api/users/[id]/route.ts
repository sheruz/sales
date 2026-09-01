import { NextRequest, NextResponse } from "next/server";
import { authService } from "@/services/auth.service";
import { updateUserSchema } from "@/lib/auth/schemas";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { apiSuccess, ForbiddenError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !hasPermission(currentUser.role, "users:manage")) {
      throw new ForbiddenError();
    }

    const { id } = await params;
    const body = await request.json();
    const input = updateUserSchema.parse(body);
    const updated = await authService.updateUser(id, input);

    return NextResponse.json(apiSuccess(updated));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !hasPermission(currentUser.role, "users:manage")) {
      throw new ForbiddenError();
    }

    const { id } = await params;
    await authService.deactivateUser(id, currentUser.id);

    return NextResponse.json(apiSuccess({ message: "User deactivated" }));
  } catch (error) {
    return handleApiError(error);
  }
}
