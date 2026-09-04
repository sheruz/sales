import { NextRequest, NextResponse } from "next/server";
import { taskService } from "@/services/task.service";
import { createTaskSchema } from "@/lib/validations/lead";
import { requireOrgPermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireOrgPermission("leads.view");
    const { id } = await params;
    const tasks = await taskService.list(user.organizationId, { leadId: id });
    return NextResponse.json(apiSuccess(tasks));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireOrgPermission("leads.update");
    const { id } = await params;
    const body = await request.json();
    const input = createTaskSchema.parse(body);
    const task = await taskService.create(
      user.organizationId,
      { ...input, leadId: id },
      user.id
    );
    return NextResponse.json(apiSuccess(task), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
