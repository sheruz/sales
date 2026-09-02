import { NextRequest, NextResponse } from "next/server";
import { authService } from "@/services/auth.service";
import { getCurrentUser } from "@/lib/auth/session";
import { changePasswordSchema } from "@/lib/auth/profile-schemas";
import { apiSuccess, UnauthorizedError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();

    const body = changePasswordSchema.parse(await request.json());
    await authService.changePassword(user.id, body.currentPassword, body.newPassword);
    return NextResponse.json(apiSuccess({ changed: true }));
  } catch (error) {
    return handleApiError(error);
  }
}
