import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { businessBrainService } from "@/services/business-brain.service";
import { requireOrgPermission, requireOrganizationContext } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

const profileSchema = z.object({
  companyName: z.string().min(1).max(200),
  description: z.string().max(5000).nullable().optional(),
  website: z.string().max(500).nullable().optional(),
  industry: z.string().max(200).nullable().optional(),
  locations: z.array(z.string()).optional(),
  targetMarkets: z.array(z.string()).optional(),
  companySize: z.string().max(100).nullable().optional(),
  yearsInBusiness: z.coerce.number().int().min(0).max(300).nullable().optional(),
  positioning: z.string().max(2000).nullable().optional(),
  valueProposition: z.string().max(2000).nullable().optional(),
  competitiveAdvantages: z.array(z.string()).optional(),
  metadata: z.unknown().optional(),
});

export async function GET() {
  try {
    await requireOrgPermission("organization.view");
    const user = await requireOrganizationContext();
    const profile = await businessBrainService.getProfile(user.organizationId);
    return NextResponse.json(apiSuccess(profile));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireOrgPermission("business_brain.manage");
    const user = await requireOrganizationContext();
    const body = profileSchema.parse(await request.json());
    const profile = await businessBrainService.upsertProfile(
      user.organizationId,
      body
    );
    return NextResponse.json(apiSuccess(profile));
  } catch (error) {
    return handleApiError(error);
  }
}
