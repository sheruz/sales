import { NextRequest, NextResponse } from "next/server";
import { authService } from "@/services/auth.service";
import { getCurrentUser } from "@/lib/auth/session";
import { updateProfileSchema } from "@/lib/auth/profile-schemas";
import { apiSuccess, UnauthorizedError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();

    const body = updateProfileSchema.parse(await request.json());
    const updated = await authService.updateProfile(user.id, body);
    return NextResponse.json(apiSuccess({ user: updated }));
  } catch (error) {
    return handleApiError(error);
  }
}
