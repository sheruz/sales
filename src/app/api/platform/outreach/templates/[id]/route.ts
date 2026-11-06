import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformOutreachWrite } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { platformOutreachService } from "@/services/platform-outreach.service";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  category: z.enum(["FIRST_TOUCH", "FOLLOW_UP", "BREAKUP"]).optional(),
  subject: z.string().min(1).max(300).optional(),
  bodyText: z.string().min(1).max(20000).optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
  duplicate: z.boolean().optional(),
});

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const user = await requirePlatformOutreachWrite();
    const { id } = await ctx.params;
    const body = patchSchema.parse(await request.json());
    if (body.duplicate) {
      const template = await platformOutreachService.duplicateTemplate(
        id,
        user.id
      );
      return NextResponse.json(apiSuccess({ template }));
    }
    const template = await platformOutreachService.updateTemplate(
      id,
      body,
      user.id
    );
    return NextResponse.json(apiSuccess({ template }));
  } catch (error) {
    return handleApiError(error);
  }
}
