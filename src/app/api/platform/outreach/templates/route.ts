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
    const templates = await platformOutreachService.listTemplates();
    return NextResponse.json(apiSuccess({ templates }));
  } catch (error) {
    return handleApiError(error);
  }
}

const createSchema = z.object({
  name: z.string().min(1).max(120),
  category: z.enum(["FIRST_TOUCH", "FOLLOW_UP", "BREAKUP"]),
  subject: z.string().min(1).max(300),
  bodyText: z.string().min(1).max(20000),
  key: z.string().max(64).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requirePlatformOutreachWrite();
    const body = createSchema.parse(await request.json());
    const template = await platformOutreachService.createTemplate({
      ...body,
      actorUserId: user.id,
    });
    return NextResponse.json(apiSuccess({ template }));
  } catch (error) {
    return handleApiError(error);
  }
}
