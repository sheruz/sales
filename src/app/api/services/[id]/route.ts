import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CatalogItemStatus } from "@prisma/client";
import { serviceCatalogService } from "@/services/service-catalog.service";
import { requireOrgPermission, requireOrganizationContext } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(5000).optional(),
  category: z.string().max(200).optional(),
  pricingModel: z.string().max(100).optional(),
  targetClientType: z.string().max(500).optional(),
  idealCustomer: z.string().max(1000).optional(),
  problemsSolved: z.array(z.string()).optional(),
  minBudget: z.coerce.number().optional().nullable(),
  maxBudget: z.coerce.number().optional().nullable(),
  currency: z.string().max(8).optional(),
  typicalTimeline: z.string().max(200).optional(),
  technologies: z.array(z.string()).optional(),
  talkingPoints: z.array(z.string()).optional(),
  status: z.nativeEnum(CatalogItemStatus).optional(),
  isActive: z.boolean().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    await requireOrgPermission("organization.view");
    const user = await requireOrganizationContext();
    const { id } = await params;
    const service = await serviceCatalogService.getById(user.organizationId, id);
    return NextResponse.json(apiSuccess(service));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await requireOrgPermission("business_brain.manage");
    const user = await requireOrganizationContext();
    const { id } = await params;
    const input = updateSchema.parse(await request.json());
    const service = await serviceCatalogService.update(
      user.organizationId,
      id,
      input
    );
    return NextResponse.json(apiSuccess(service));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    await requireOrgPermission("business_brain.manage");
    const user = await requireOrganizationContext();
    const { id } = await params;
    await serviceCatalogService.delete(user.organizationId, id);
    return NextResponse.json(apiSuccess({ deleted: true }));
  } catch (error) {
    return handleApiError(error);
  }
}
