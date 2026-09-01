import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { UnauthorizedError } from "@/lib/api/response";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      throw new UnauthorizedError();
    }

    return NextResponse.json(apiSuccess({ user }));
  } catch (error) {
    return handleApiError(error);
  }
}
