import { NextRequest, NextResponse } from "next/server";
import { leadService } from "@/services/lead.service";
import { bulkLeadActionSchema } from "@/lib/validations/lead";
import { requireOrgPermission, requireOrganizationContext } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

export async function POST(request: NextRequest) {
  try {
    await requireOrgPermission("leads.update");
    const user = await requireOrganizationContext();
    const body = await request.json();
    const input = bulkLeadActionSchema.parse(body);
    const result = await leadService.bulkAction(user.organizationId, input, user.id);
    return NextResponse.json(apiSuccess(result));
  } catch (error) {
    return handleApiError(error);
  }
}
