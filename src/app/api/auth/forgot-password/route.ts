import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authService } from "@/services/auth.service";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

const schema = z.object({
  email: z.string().email(),
});

/**
 * Public password-reset request.
 * In production, email the token; never log it.
 * When NODE_ENV !== production, include resetPath for local testing only.
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = schema.parse(await request.json());
    const { token } = await authService.requestPasswordReset(email);

    const payload: { ok: true; resetPath?: string } = { ok: true };
    if (token && process.env.NODE_ENV !== "production") {
      payload.resetPath = `/reset-password?token=${token}`;
    }

    return NextResponse.json(apiSuccess(payload));
  } catch (error) {
    return handleApiError(error);
  }
}
