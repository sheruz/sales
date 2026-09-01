import { NextRequest, NextResponse } from "next/server";
import { taskService } from "@/services/task.service";
import { TaskStatus } from "@prisma/client";
import { requirePermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission("tasks:read");
    const params = request.nextUrl.searchParams;
    const overdue = params.get("overdue") === "true";
    const status = params.get("status") as TaskStatus | null;

    const tasks = await taskService.list({
      assignedToId: user.role === "SALES_REPRESENTATIVE" ? user.id : undefined,
      status: status ?? undefined,
      overdue,
    });

    return NextResponse.json(apiSuccess(tasks));
  } catch (error) {
    return handleApiError(error);
  }
}
