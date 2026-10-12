import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { websiteAuditService } from "@/services/website-audit.service";
import {
  requireAnyOrgPermission,
  requireOrganizationContext,
} from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

const SOURCING_PERMS = [
  "integrations.manage",
  "campaigns.manage",
  "business_brain.manage",
] as const;

const patchSchema = z.object({
  action: z.enum(["approve", "reject", "edit", "regenerate"]),
  personalizedFirstLine: z.string().min(1).max(500).optional(),
  shortPitch: z.string().min(1).max(4000).optional(),
});

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAnyOrgPermission([...SOURCING_PERMS]);
    await requireOrganizationContext();
    const { id } = await ctx.params;
    const body = patchSchema.parse(await request.json());

    if (body.action === "approve") {
      const pitch = await websiteAuditService.approvePitch(
        user.organizationId,
        id,
        user.id
      );
      return NextResponse.json(apiSuccess({ pitch }));
    }
    if (body.action === "reject") {
      const pitch = await websiteAuditService.rejectPitch(
        user.organizationId,
        id,
        user.id
      );
      return NextResponse.json(apiSuccess({ pitch }));
    }
    if (body.action === "edit") {
      const pitch = await websiteAuditService.editPitch(
        user.organizationId,
        id,
        user.id,
        {
          personalizedFirstLine: body.personalizedFirstLine,
          shortPitch: body.shortPitch,
        }
      );
      return NextResponse.json(apiSuccess({ pitch }));
    }
    const result = await websiteAuditService.regeneratePitch(
      user.organizationId,
      id,
      user.id
    );
    return NextResponse.json(apiSuccess(result));
  } catch (error) {
    return handleApiError(error);
  }
}
