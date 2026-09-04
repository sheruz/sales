import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { MeetingOutcome, MeetingType } from "@prisma/client";
import { meetingService } from "@/services/meeting.service";
import { requirePermission, requireOrganizationContext } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("meetings:read");
    const user = await requireOrganizationContext();
    const opportunityId =
      request.nextUrl.searchParams.get("opportunityId") ?? undefined;
    const upcoming = request.nextUrl.searchParams.get("upcoming") === "1";
    const meetings = await meetingService.list(user.organizationId, {
      opportunityId,
      upcoming,
    });
    return NextResponse.json(apiSuccess(meetings));
  } catch (error) {
    return handleApiError(error);
  }
}

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional().nullable(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime().optional().nullable(),
  durationMinutes: z.coerce.number().min(5).max(480).optional(),
  timezone: z.string().max(64).optional(),
  location: z.string().max(500).optional().nullable(),
  meetingUrl: z.string().url().optional().nullable().or(z.literal("")),
  type: z.nativeEnum(MeetingType).optional(),
  opportunityId: z.string().uuid().optional().nullable(),
  companyId: z.string().uuid().optional().nullable(),
  contactId: z.string().uuid().optional().nullable(),
  leadId: z.string().uuid().optional().nullable(),
  dealId: z.string().uuid().optional().nullable(),
  notes: z.string().max(10000).optional().nullable(),
  advanceOpportunity: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    await requirePermission("meetings:write");
    const user = await requireOrganizationContext();
    const input = createSchema.parse(await request.json());
    const meeting = await meetingService.create(
      user.organizationId,
      {
        ...input,
        meetingUrl: input.meetingUrl || null,
      },
      user.id
    );
    return NextResponse.json(apiSuccess(meeting), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
