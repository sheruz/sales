import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { BrainDocumentStatus, BrainDocumentType } from "@prisma/client";
import { businessBrainService } from "@/services/business-brain.service";
import { requireOrgPermission, requireOrganizationContext } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

const createSchema = z.object({
  type: z.nativeEnum(BrainDocumentType),
  title: z.string().min(1).max(300),
  content: z.string().min(1).max(50000),
  sourceType: z.string().max(100).nullable().optional(),
  sourceUrl: z.string().max(1000).nullable().optional(),
  status: z.nativeEnum(BrainDocumentStatus).optional(),
});

export async function GET() {
  try {
    await requireOrgPermission("organization.view");
    const user = await requireOrganizationContext();
    const docs = await businessBrainService.listDocuments(user.organizationId);
    return NextResponse.json(apiSuccess(docs));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireOrgPermission("business_brain.manage");
    const user = await requireOrganizationContext();
    const body = createSchema.parse(await request.json());
    const doc = await businessBrainService.createDocument(
      user.organizationId,
      user.id,
      body
    );
    return NextResponse.json(apiSuccess(doc), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
