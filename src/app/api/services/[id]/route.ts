import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { serviceCatalogService } from "@/services/service-catalog.service";
import { requirePermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(5000).optional(),
  targetClientType: z.string().max(500).optional(),
  minBudget: z.coerce.number().optional(),
  maxBudget: z.coerce.number().optional(),
  typicalTimeline: z.string().max(200).optional(),
  technologies: z.array(z.string()).optional(),
  talkingPoints: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission("settings:write");
    const { id } = await params;
    const input = updateSchema.parse(await request.json());
    const service = await serviceCatalogService.update(id, input);
    return NextResponse.json(apiSuccess(service));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    await requirePermission("settings:write");
    const { id } = await params;
    await serviceCatalogService.delete(id);
    return NextResponse.json(apiSuccess({ deleted: true }));
  } catch (error) {
    return handleApiError(error);
  }
}
