import { NextRequest, NextResponse } from "next/server";
import { linkedInService } from "@/services/linkedin.service";
import { linkedInDiscoverySchema } from "@/lib/validations/automation";
import { requirePermission, requireOrganizationContext } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission("ai:use");
    const user = await requireOrganizationContext();
    const { id: campaignId } = await params;
    const body = await request.json();
    const input = linkedInDiscoverySchema.parse({ ...body, campaignId });

    const job = await linkedInService.createDiscoveryJob(
      user.organizationId,
      input,
      user.id
    );

    // Process async — don't block response
    linkedInService.processDiscoveryJob(job.id).catch(console.error);

    return NextResponse.json(apiSuccess(job), { status: 202 });
  } catch (error) {
    return handleApiError(error);
  }
}
