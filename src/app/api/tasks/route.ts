import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { TaskPriority, TaskStatus, TaskType } from "@prisma/client";
import { taskService } from "@/services/task.service";
import { requireAnyOrgPermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAnyOrgPermission([
      "leads.view",
      "opportunities.view",
    ]);
    const params = request.nextUrl.searchParams;
    const overdue = params.get("overdue") === "true";
    const status = params.get("status") as TaskStatus | null;
    const opportunityId = params.get("opportunityId") ?? undefined;

    const tasks = await taskService.list(user.organizationId, {
      assignedToId: user.role === "SALES_REPRESENTATIVE" ? user.id : undefined,
      status: status ?? undefined,
      overdue,
      opportunityId,
    });

    return NextResponse.json(apiSuccess(tasks));
  } catch (error) {
    return handleApiError(error);
  }
}

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional().nullable(),
  type: z.nativeEnum(TaskType).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  dueDate: z.string().datetime().optional().nullable(),
  assignedToId: z.string().uuid().optional().nullable(),
  leadId: z.string().uuid().optional().nullable(),
  opportunityId: z.string().uuid().optional().nullable(),
  companyId: z.string().uuid().optional().nullable(),
  contactId: z.string().uuid().optional().nullable(),
  dealId: z.string().uuid().optional().nullable(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAnyOrgPermission([
      "leads.update",
      "opportunities.update",
    ]);
    const input = createSchema.parse(await request.json());
    const task = await taskService.create(user.organizationId, input, user.id);
    return NextResponse.json(apiSuccess(task), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
