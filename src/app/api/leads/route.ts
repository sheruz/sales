import { NextRequest, NextResponse } from "next/server";
import { leadService } from "@/services/lead.service";
import { createLeadSchema, leadListQuerySchema } from "@/lib/validations/lead";
import { requirePermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("leads:read");
    const params = Object.fromEntries(request.nextUrl.searchParams);
    const query = leadListQuerySchema.parse(params);
    const result = await leadService.list(query);
    return NextResponse.json(apiSuccess(result.leads, { pagination: result.pagination }));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("leads:write");
    const body = await request.json();
    const input = createLeadSchema.parse(body);
    const lead = await leadService.create(input, user.id);
    return NextResponse.json(apiSuccess(lead), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
