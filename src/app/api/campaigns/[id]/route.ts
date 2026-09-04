import { NextRequest, NextResponse } from "next/server";
import { campaignService } from "@/services/campaign.service";
import { updateCampaignSchema } from "@/lib/validations/automation";
import { requireOrgPermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireOrgPermission("campaigns.manage");
    const { id } = await params;
    const campaign = await campaignService.getById(user.organizationId, id);
    return NextResponse.json(apiSuccess(campaign));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireOrgPermission("campaigns.manage");
    const { id } = await params;
    const body = await request.json();
    const input = updateCampaignSchema.parse(body);
    const campaign = await campaignService.update(user.organizationId, id, input);
    return NextResponse.json(apiSuccess(campaign));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireOrgPermission("campaigns.manage");
    const { id } = await params;
    await campaignService.delete(user.organizationId, id);
    return NextResponse.json(apiSuccess({ deleted: true }));
  } catch (error) {
    return handleApiError(error);
  }
}
