import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { organizationService } from "@/services/organization.service";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { createSession, setSessionCookie } from "@/lib/auth/session";

const acceptSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});

/** Public: accept organization invitation */
export async function POST(request: NextRequest) {
  try {
    const body = acceptSchema.parse(await request.json());
    const result = await organizationService.acceptInvitation(body);

    const token = await createSession(result.userId, {
      organizationId: result.organizationId,
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
      userAgent: request.headers.get("user-agent") ?? undefined,
    });

    const response = NextResponse.json(
      apiSuccess({
        organizationId: result.organizationId,
        organizationSlug: result.organizationSlug,
      })
    );
    return setSessionCookie(response, token);
  } catch (error) {
    return handleApiError(error);
  }
}
