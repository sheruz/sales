import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { billingService } from "@/services/billing.service";
import {
  requireOrgPermission,
  requireOrganizationContext,
} from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

const schema = z.object({
  planId: z.string().uuid(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

export async function POST(request: NextRequest) {
  try {
    await requireOrgPermission("billing.manage");
    const user = await requireOrganizationContext();
    const body = schema.parse(await request.json());
    const result = await billingService.changePlan({
      organizationId: user.organizationId,
      planId: body.planId,
      userEmail: user.email,
    });
    return NextResponse.json(apiSuccess(result));
  } catch (error) {
    return handleApiError(error);
  }
}
