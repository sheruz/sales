import { NextRequest, NextResponse } from "next/server";
import { authService } from "@/services/auth.service";
import { createUserSchema } from "@/lib/auth/schemas";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { apiSuccess, ForbiddenError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || !hasPermission(user.role, "users:manage")) {
      throw new ForbiddenError();
    }

    const users = await authService.listUsers();
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
    const newUser = await authService.createUser(input, user.role);

    return NextResponse.json(apiSuccess(newUser), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
