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
    const campaigns = await platformOutreachService.listCampaigns();
    return NextResponse.json(apiSuccess({ campaigns }));
  } catch (error) {
    return handleApiError(error);
  }
}

const createSchema = z.object({
  name: z.string().min(1).max(160),
  sendCap: z.number().int().min(1).max(500).optional(),
  followUpDelayDays: z.number().int().min(1).max(30).optional(),
  emailAccountId: z.string().uuid().nullable().optional(),
  rotateAccounts: z.boolean().optional(),
  hasWebsiteTemplateId: z.string().uuid().nullable().optional(),
  noWebsiteTemplateId: z.string().uuid().nullable().optional(),
  followUpTemplateId: z.string().uuid().nullable().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requirePlatformOutreachWrite();
    const body = createSchema.parse(await request.json());
    const campaign = await platformOutreachService.createCampaign({
      ...body,
      actorUserId: user.id,
    });
    return NextResponse.json(apiSuccess({ campaign }));
  } catch (error) {
    return handleApiError(error);
  }
}
