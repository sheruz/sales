import { NextResponse } from "next/server";
import { authService } from "@/services/auth.service";
import {
  clearSessionCookie,
  getSessionTokenFromCookies,
} from "@/lib/auth/session";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

export async function POST() {
  try {
    const token = await getSessionTokenFromCookies();

    if (token) {
      await authService.logout(token);
    }

    const response = NextResponse.json(apiSuccess({ message: "Logged out" }));
    return clearSessionCookie(response);
  } catch (error) {
    return handleApiError(error);
  }
}
