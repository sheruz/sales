import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CatalogItemStatus } from "@prisma/client";
import { icpService } from "@/services/icp.service";
import { requireOrgPermission, requireOrganizationContext } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

interface Params {
  params: Promise<{ id: string }>;
}

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  industries: z.array(z.string()).optional(),
  countries: z.array(z.string()).optional(),
  regions: z.array(z.string()).optional(),
  companySizes: z.array(z.string()).optional(),
  revenueRanges: z.array(z.string()).optional(),
  technologies: z.array(z.string()).optional(),
  fundingStages: z.array(z.string()).optional(),
  fundingMin: z.coerce.number().nullable().optional(),
  fundingMax: z.coerce.number().nullable().optional(),
  jobSignals: z.array(z.string()).optional(),
  buyingSignals: z.array(z.string()).optional(),
  decisionMakerTitles: z.array(z.string()).optional(),
  exclusions: z.array(z.string()).optional(),
  priority: z.coerce.number().int().optional(),
  status: z.nativeEnum(CatalogItemStatus).optional(),
});

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await requireOrgPermission("organization.view");
    const user = await requireOrganizationContext();
    const { id } = await params;
    const icp = await icpService.getById(user.organizationId, id);
    return NextResponse.json(apiSuccess(icp));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    await requireOrgPermission("business_brain.manage");
    const user = await requireOrganizationContext();
    const { id } = await params;
    const body = updateSchema.parse(await request.json());
    const icp = await icpService.update(user.organizationId, id, body);
    return NextResponse.json(apiSuccess(icp));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    await requireOrgPermission("business_brain.manage");
    const user = await requireOrganizationContext();
    const { id } = await params;
    await icpService.delete(user.organizationId, id);
    return NextResponse.json(apiSuccess({ ok: true }));
  } catch (error) {
    return handleApiError(error);
  }
}
