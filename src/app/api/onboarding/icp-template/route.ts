import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  requireOrgPermission,
  requireOrganizationContext,
} from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { onboardingService } from "@/services/onboarding.service";
import { ICP_TEMPLATES } from "@/lib/onboarding/icp-templates";

const bodySchema = z.object({
  templateId: z.enum([
    "trucking",
    "construction",
    "clinics",
    "property_management",
    "generic",
  ]),
});

export async function GET() {
  try {
    await requireOrgPermission("organization.view");
    return NextResponse.json(apiSuccess({ templates: ICP_TEMPLATES }));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireOrgPermission("organization.update");
    const user = await requireOrganizationContext();
    const body = bodySchema.parse(await request.json());
    const icp = await onboardingService.applyIcpTemplate(
      user.organizationId,
      body.templateId
    );
    return NextResponse.json(apiSuccess({ icp }));
  } catch (error) {
    return handleApiError(error);
  }
}
