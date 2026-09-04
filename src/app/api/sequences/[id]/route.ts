import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ConversationChannel, OutreachSequenceStatus } from "@prisma/client";
import { outreachSequenceService } from "@/services/outreach-sequence.service";
import { requireOrgPermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

interface Params {
  params: Promise<{ id: string }>;
}

const stepSchema = z.object({
  stepOrder: z.number().int().min(0),
  delayMinutes: z.number().int().min(0).optional(),
  channel: z.nativeEnum(ConversationChannel).optional(),
  subjectTemplate: z.string().max(500).optional().nullable(),
  bodyTemplate: z.string().min(1).max(50000),
  condition: z.any().optional().nullable(),
  isActive: z.boolean().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  status: z.nativeEnum(OutreachSequenceStatus).optional(),
  stopOnReply: z.boolean().optional(),
  stopOnMeeting: z.boolean().optional(),
  stopOnUnsubscribe: z.boolean().optional(),
  steps: z.array(stepSchema).optional(),
});

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const user = await requireOrgPermission("sequences.manage");
    const { id } = await params;
    const sequence = await outreachSequenceService.getById(
      user.organizationId,
      id
    );
    return NextResponse.json(apiSuccess(sequence));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const user = await requireOrgPermission("sequences.manage");
    const { id } = await params;
    const input = updateSchema.parse(await request.json());
    const sequence = await outreachSequenceService.update(
      user.organizationId,
      id,
      input
    );
    return NextResponse.json(apiSuccess(sequence));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const user = await requireOrgPermission("sequences.manage");
    const { id } = await params;
    const sequence = await outreachSequenceService.archive(
      user.organizationId,
      id
    );
    return NextResponse.json(apiSuccess(sequence));
  } catch (error) {
    return handleApiError(error);
  }
}
