import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CatalogItemStatus } from "@prisma/client";
import { serviceCatalogService } from "@/services/service-catalog.service";
import { requireOrgPermission, requireOrganizationContext } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  category: z.string().max(200).optional(),
  pricingModel: z.string().max(100).optional(),
  minBudget: z.coerce.number().optional().nullable(),
  maxBudget: z.coerce.number().optional().nullable(),
  currency: z.string().max(8).optional(),
  typicalTimeline: z.string().max(200).optional(),
  targetClientType: z.string().max(500).optional(),
  idealCustomer: z.string().max(1000).optional(),
  problemsSolved: z.array(z.string()).optional(),
  technologies: z.array(z.string()).optional(),
  talkingPoints: z.array(z.string()).optional(),
  status: z.nativeEnum(CatalogItemStatus).optional(),
  isActive: z.boolean().optional(),
});

export async function GET() {
  try {
    await requireOrgPermission("organization.view");
    const user = await requireOrganizationContext();
    const services = await serviceCatalogService.list(user.organizationId, true);
    return NextResponse.json(apiSuccess(services));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireOrgPermission("business_brain.manage");
    const user = await requireOrganizationContext();
    const input = createSchema.parse(await request.json());
    const service = await serviceCatalogService.create(user.organizationId, input);
    return NextResponse.json(apiSuccess(service), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
