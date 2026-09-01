import { NextRequest, NextResponse } from "next/server";
import { linkedInService } from "@/services/linkedin.service";
import { linkedInDiscoverySchema } from "@/lib/validations/automation";
import { requirePermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("ai:use");
    const body = await request.json();
    const input = linkedInDiscoverySchema.parse(body);

    const job = await linkedInService.createDiscoveryJob(input, user.id);
    const result = await linkedInService.processDiscoveryJob(job.id);

    return NextResponse.json(apiSuccess({ job, ...result }), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
