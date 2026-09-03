import { NextRequest, NextResponse } from "next/server";
import { leadService } from "@/services/lead.service";
import { createLeadSchema, leadListQuerySchema } from "@/lib/validations/lead";
import { requireOrgPermission, requireOrganizationContext } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

export async function GET(request: NextRequest) {
  try {
    await requireOrgPermission("leads.view");
    const user = await requireOrganizationContext();
    const params = Object.fromEntries(request.nextUrl.searchParams);
    const query = leadListQuerySchema.parse(params);
    const result = await leadService.list(user.organizationId, query);
    return NextResponse.json(apiSuccess(result.leads, { pagination: result.pagination }));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireOrgPermission("leads.create");
    const user = await requireOrganizationContext();
    const body = await request.json();
    const input = createLeadSchema.parse(body);
    const lead = await leadService.create(user.organizationId, input, user.id);
    return NextResponse.json(apiSuccess(lead), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
