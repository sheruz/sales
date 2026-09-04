import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ConversationChannel, OutreachSequenceStatus } from "@prisma/client";
import { outreachSequenceService } from "@/services/outreach-sequence.service";
import { requireOrgPermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

const stepSchema = z.object({
  stepOrder: z.number().int().min(0),
  delayMinutes: z.number().int().min(0).optional(),
  channel: z.nativeEnum(ConversationChannel).optional(),
  subjectTemplate: z.string().max(500).optional().nullable(),
  bodyTemplate: z.string().min(1).max(50000),
  condition: z.any().optional().nullable(),
  isActive: z.boolean().optional(),
});

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  status: z.nativeEnum(OutreachSequenceStatus).optional(),
  stopOnReply: z.boolean().optional(),
  stopOnMeeting: z.boolean().optional(),
  stopOnUnsubscribe: z.boolean().optional(),
  steps: z.array(stepSchema).optional(),
});

export async function GET() {
  try {
    const user = await requireOrgPermission("sequences.manage");
    const sequences = await outreachSequenceService.list(user.organizationId);
    return NextResponse.json(apiSuccess(sequences));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireOrgPermission("sequences.manage");
    const input = createSchema.parse(await request.json());
    const sequence = await outreachSequenceService.create(
      user.organizationId,
      input
    );
    return NextResponse.json(apiSuccess(sequence), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
