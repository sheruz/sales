import { NextRequest, NextResponse } from "next/server";
import { taskService } from "@/services/task.service";
import { createTaskSchema } from "@/lib/validations/lead";
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
    const tasks = await taskService.list({ leadId: id });
    return NextResponse.json(apiSuccess(tasks));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requirePermission("leads:write");
    const { id } = await params;
    const body = await request.json();
    const input = createTaskSchema.parse(body);
    const task = await taskService.create({ ...input, leadId: id }, user.id);
    return NextResponse.json(apiSuccess(task), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
