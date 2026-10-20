import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/api-auth";
import { apiSuccess, ValidationError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { mfaService } from "@/services/mfa.service";
import { UserRole } from "@prisma/client";

export async function GET() {
  try {
    const user = await requireUser();
    const status = await mfaService.getStatus(user.id);
    return NextResponse.json(apiSuccess(status));
  } catch (error) {
    return handleApiError(error);
  }
}

const postSchema = z.object({
  action: z.enum(["begin", "confirm"]),
  code: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const isSa =
      user.role === UserRole.SUPER_ADMIN ||
      user.platformRole === "SUPER_ADMIN";
    if (!isSa) {
      throw new ValidationError("2FA setup is for Super Admin accounts");
    }
    const body = postSchema.parse(await request.json());
    if (body.action === "begin") {
      const setup = await mfaService.beginSetup(user.id);
      return NextResponse.json(apiSuccess(setup));
    }
    if (!body.code) throw new ValidationError("code required");
    const result = await mfaService.confirmSetup(user.id, body.code, user.id);
    return NextResponse.json(apiSuccess(result));
  } catch (error) {
    return handleApiError(error);
  }
}
