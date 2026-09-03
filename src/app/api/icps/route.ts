import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CatalogItemStatus } from "@prisma/client";
import { icpService } from "@/services/icp.service";
import { requireOrgPermission, requireOrganizationContext } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

const icpSchema = z.object({
  name: z.string().min(1).max(200),
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

export async function GET() {
  try {
    await requireOrgPermission("organization.view");
    const user = await requireOrganizationContext();
    const icps = await icpService.list(user.organizationId, true);
    return NextResponse.json(apiSuccess(icps));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireOrgPermission("business_brain.manage");
    const user = await requireOrganizationContext();
    const body = icpSchema.parse(await request.json());
    const icp = await icpService.create(user.organizationId, body);
    return NextResponse.json(apiSuccess(icp), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
