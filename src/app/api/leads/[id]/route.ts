import { NextRequest, NextResponse } from "next/server";
import { leadService } from "@/services/lead.service";
import { updateLeadSchema } from "@/lib/validations/lead";
import { requirePermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission("leads:read");
    const { id } = await params;
    const lead = await leadService.getById(id);
    return NextResponse.json(apiSuccess(lead));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requirePermission("leads:write");
    const { id } = await params;
    const body = await request.json();
    const input = updateLeadSchema.parse(body);
    const lead = await leadService.update(id, input, user.id);
    return NextResponse.json(apiSuccess(lead));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requirePermission("leads:delete");
    const { id } = await params;
    await leadService.delete(id, user.id);
    return NextResponse.json(apiSuccess({ message: "Lead deleted" }));
  } catch (error) {
    return handleApiError(error);
  }
}
