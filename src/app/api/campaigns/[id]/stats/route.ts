import { NextResponse } from "next/server";
import { campaignService } from "@/services/campaign.service";
import { requirePermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    await requirePermission("campaigns:read");
    const { id } = await params;
    const stats = await campaignService.getStats(id);
    return NextResponse.json(apiSuccess(stats));
  } catch (error) {
    return handleApiError(error);
  }
}
