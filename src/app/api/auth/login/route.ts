import { NextRequest, NextResponse } from "next/server";
import { authService } from "@/services/auth.service";
import { loginSchema } from "@/lib/auth/schemas";
import { setSessionCookie } from "@/lib/auth/session";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { assertAuthRateLimit } from "@/lib/security/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = loginSchema.parse(body);

    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";
    const userAgent = request.headers.get("user-agent") ?? undefined;

    assertAuthRateLimit(ipAddress, input.email);

    const { user, token } = await authService.login(
      input.email,
      input.password,
      { ipAddress, userAgent }
    );

    const response = NextResponse.json(apiSuccess({ user }));
    return setSessionCookie(response, token);
  } catch (error) {
    return handleApiError(error);
  }
}
