import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { serviceCatalogService } from "@/services/service-catalog.service";
import { requirePermission, requireOrganizationContext } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  targetClientType: z.string().max(500).optional(),
  minBudget: z.coerce.number().optional(),
  maxBudget: z.coerce.number().optional(),
  typicalTimeline: z.string().max(200).optional(),
  technologies: z.array(z.string()).optional(),
  talkingPoints: z.array(z.string()).optional(),
});

export async function GET() {
  try {
    await requirePermission("campaigns:read");
    const user = await requireOrganizationContext();
    const services = await serviceCatalogService.list(user.organizationId);
    return NextResponse.json(apiSuccess(services));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission("settings:write");
    const user = await requireOrganizationContext();
    const input = createSchema.parse(await request.json());
    const service = await serviceCatalogService.create(user.organizationId, input);
    return NextResponse.json(apiSuccess(service), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
