import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { MeetingOutcome, MeetingType } from "@prisma/client";
import { meetingService } from "@/services/meeting.service";
import { requirePermission, requireOrganizationContext } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await requirePermission("meetings:read");
    const user = await requireOrganizationContext();
    const { id } = await params;
    const meeting = await meetingService.getById(user.organizationId, id);
    return NextResponse.json(apiSuccess(meeting));
  } catch (error) {
    return handleApiError(error);
  }
}

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional().nullable(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional().nullable(),
  timezone: z.string().max(64).optional(),
  location: z.string().max(500).optional().nullable(),
  meetingUrl: z.string().optional().nullable(),
  outcome: z.nativeEnum(MeetingOutcome).optional(),
  notes: z.string().max(10000).optional().nullable(),
  type: z.nativeEnum(MeetingType).optional(),
});

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    await requirePermission("meetings:write");
    const user = await requireOrganizationContext();
    const { id } = await params;
    const input = patchSchema.parse(await request.json());
    const meeting = await meetingService.update(user.organizationId, id, input);
    return NextResponse.json(apiSuccess(meeting));
  } catch (error) {
    return handleApiError(error);
  }
}
