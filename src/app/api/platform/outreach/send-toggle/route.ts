import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  requirePlatformRead,
  requirePlatformOutreachWrite,
} from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { platformOutreachService } from "@/services/platform-outreach.service";

export async function GET() {
  try {
    await requirePlatformRead();
    const enabled = await platformOutreachService.getSendEnabled();
    return NextResponse.json(
      apiSuccess({
        enabled,
        organizationId: platformOutreachService.ownerOrgId(),
      })
    );
  } catch (error) {
    return handleApiError(error);
  }
}

const patchSchema = z.object({
  enabled: z.boolean(),
  reason: z.string().max(500).optional(),
});

export async function PATCH(request: NextRequest) {
  try {
    const user = await requirePlatformOutreachWrite();
    const body = patchSchema.parse(await request.json());
    const result = await platformOutreachService.setSendEnabled(
      body.enabled,
      user.id,
      body.reason
    );
    return NextResponse.json(apiSuccess(result));
  } catch (error) {
    return handleApiError(error);
  }
}
