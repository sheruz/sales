import { NextRequest, NextResponse } from "next/server";
import { authService } from "@/services/auth.service";
import { organizationService } from "@/services/organization.service";
import { createUserSchema } from "@/lib/auth/schemas";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { apiSuccess, ForbiddenError, ValidationError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || !hasPermission(user.role, "users:manage")) {
      throw new ForbiddenError();
    }

    if (user.isPlatformAdmin) {
      const users = await authService.listUsers();
      return NextResponse.json(apiSuccess(users));
    }

    if (!user.organizationId) {
      throw new ForbiddenError("No active organization");
    }

    const members = await organizationService.listMembers(user.organizationId);
    const users = members.map((m) => ({
      id: m.user.id,
      email: m.user.email,
      firstName: m.user.firstName,
      lastName: m.user.lastName,
      role: m.user.role,
      isActive: m.status === "ACTIVE" && m.user.isActive,
      createdAt: m.user.createdAt,
      updatedAt: m.user.updatedAt,
    }));

    return NextResponse.json(apiSuccess(users));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasPermission(user.role, "users:manage")) {
      throw new ForbiddenError();
    }

    const body = await request.json();
    const input = createUserSchema.parse(body);

    if (!user.isPlatformAdmin && !user.organizationId) {
      throw new ValidationError("No active organization");
    }

    const newUser = await authService.createUser(
      input,
      user.role,
      user.isPlatformAdmin ? null : user.organizationId
    );

    return NextResponse.json(apiSuccess(newUser), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
