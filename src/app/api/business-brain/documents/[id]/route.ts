import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { BrainDocumentStatus, BrainDocumentType } from "@prisma/client";
import { businessBrainService } from "@/services/business-brain.service";
import { requireOrgPermission, requireOrganizationContext } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

interface Params {
  params: Promise<{ id: string }>;
}

const updateSchema = z.object({
  type: z.nativeEnum(BrainDocumentType).optional(),
  title: z.string().min(1).max(300).optional(),
  content: z.string().min(1).max(50000).optional(),
  sourceType: z.string().max(100).nullable().optional(),
  sourceUrl: z.string().max(1000).nullable().optional(),
  status: z.nativeEnum(BrainDocumentStatus).optional(),
});

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    await requireOrgPermission("business_brain.manage");
    const user = await requireOrganizationContext();
    const { id } = await params;
    const body = updateSchema.parse(await request.json());
    const doc = await businessBrainService.updateDocument(
      user.organizationId,
      id,
      user.id,
      body
    );
    return NextResponse.json(apiSuccess(doc));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    await requireOrgPermission("business_brain.manage");
    const user = await requireOrganizationContext();
    const { id } = await params;
    await businessBrainService.deleteDocument(user.organizationId, id);
    return NextResponse.json(apiSuccess({ ok: true }));
  } catch (error) {
    return handleApiError(error);
  }
}
