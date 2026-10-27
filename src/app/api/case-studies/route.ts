import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { OfferStatus } from "@prisma/client";
import {
  requireOrgPermission,
  requireOrganizationContext,
} from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { caseStudyService } from "@/services/case-study.service";

const createSchema = z.object({
  clientType: z.string().min(1).max(200),
  problem: z.string().min(1).max(5000),
  whatBuilt: z.string().min(1).max(5000),
  result: z.string().min(1).max(5000),
  status: z.nativeEnum(OfferStatus).optional(),
});

export async function GET() {
  try {
    await requireOrgPermission("organization.view");
    const user = await requireOrganizationContext();
    const rows = await caseStudyService.list(user.organizationId, true);
    return NextResponse.json(apiSuccess(rows));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireOrgPermission("business_brain.manage");
    const user = await requireOrganizationContext();
    const input = createSchema.parse(await request.json());
    const row = await caseStudyService.create(user.organizationId, input);
    return NextResponse.json(apiSuccess(row), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
