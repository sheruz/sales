import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  requireOrgPermission,
  requireOrganizationContext,
} from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { onboardingService } from "@/services/onboarding.service";
import { ONBOARDING_STEPS } from "@/lib/onboarding/steps";

const patchSchema = z.object({
  currentStep: z.enum(ONBOARDING_STEPS).optional(),
  completedSteps: z.array(z.enum(ONBOARDING_STEPS)).optional(),
  skipped: z.boolean().optional(),
  complete: z.boolean().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  markDone: z.enum(ONBOARDING_STEPS).optional(),
});

export async function GET() {
  try {
    await requireOrgPermission("organization.view");
    const user = await requireOrganizationContext();
    const snapshot = await onboardingService.snapshot(
      user.organizationId,
      user.id
    );
    return NextResponse.json(apiSuccess(snapshot));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireOrgPermission("organization.update");
    const user = await requireOrganizationContext();
    const body = patchSchema.parse(await request.json());
    if (body.markDone) {
      await onboardingService.markStepDone(user.organizationId, body.markDone);
    }
    const progress = await onboardingService.patch(user.organizationId, body);
    const snapshot = await onboardingService.snapshot(
      user.organizationId,
      user.id
    );
    return NextResponse.json(apiSuccess({ progress, ...snapshot }));
  } catch (error) {
    return handleApiError(error);
  }
}
