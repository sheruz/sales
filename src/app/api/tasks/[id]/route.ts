import { NextRequest, NextResponse } from "next/server";
import { TaskStatus } from "@prisma/client";
import { taskService } from "@/services/task.service";
import { requireAnyOrgPermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAnyOrgPermission([
      "leads.update",
      "opportunities.update",
    ]);
    const { id } = await params;
    const body = await request.json();
    const status = body.status as TaskStatus;
    const task = await taskService.updateStatus(
      user.organizationId,
      id,
      status,
      user.id
    );
    return NextResponse.json(apiSuccess(task));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAnyOrgPermission([
      "leads.update",
      "opportunities.update",
    ]);
    const { id } = await params;
    await taskService.delete(user.organizationId, id);
    return NextResponse.json(apiSuccess({ message: "Task deleted" }));
  } catch (error) {
    return handleApiError(error);
  }
}
