import { NextRequest, NextResponse } from "next/server";
import { leadService } from "@/services/lead.service";
import { updateLeadSchema } from "@/lib/validations/lead";
import { requireOrgPermission, requireOrganizationContext } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    await requireOrgPermission("leads.view");
    const user = await requireOrganizationContext();
    const { id } = await params;
    const lead = await leadService.getById(user.organizationId, id);
    return NextResponse.json(apiSuccess(lead));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await requireOrgPermission("leads.update");
    const user = await requireOrganizationContext();
    const { id } = await params;
    const body = await request.json();
    const input = updateLeadSchema.parse(body);
    const lead = await leadService.update(user.organizationId, id, input, user.id);
    return NextResponse.json(apiSuccess(lead));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    await requireOrgPermission("leads.delete");
    const user = await requireOrganizationContext();
    const { id } = await params;
    await leadService.delete(user.organizationId, id, user.id);
    return NextResponse.json(apiSuccess({ message: "Lead deleted" }));
  } catch (error) {
    return handleApiError(error);
  }
}
