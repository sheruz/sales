import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { opportunityIntelligenceService } from "@/services/opportunity-intelligence.service";
import { requireOrgPermission, requireOrganizationContext } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

interface Params {
  params: Promise<{ id: string }>;
}

const bodySchema = z
  .object({
    force: z.boolean().optional(),
  })
  .optional();

export async function POST(request: NextRequest, { params }: Params) {
  try {
    await requireOrgPermission("opportunities.update");
    const user = await requireOrganizationContext();
    const { id } = await params;
    const body = bodySchema.parse(await request.json().catch(() => ({})));
    const result = await opportunityIntelligenceService.research(
      user.organizationId,
      id,
      user.id,
      { force: body?.force }
    );
    return NextResponse.json(apiSuccess(result));
  } catch (error) {
    return handleApiError(error);
  }
}
