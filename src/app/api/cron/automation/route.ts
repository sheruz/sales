import { NextRequest, NextResponse } from "next/server";
import { automationService } from "@/services/automation.service";
import { autopilotService } from "@/services/autopilot.service";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { assertCronAuthorized } from "@/lib/security/cron-auth";

export async function POST(request: NextRequest) {
  try {
    assertCronAuthorized(request);

    const [automation, autopilot] = await Promise.all([
      automationService.processPendingJobs(),
      autopilotService.runAllEnabled(),
    ]);

    return NextResponse.json(apiSuccess({ automation, autopilot }));
  } catch (error) {
    return handleApiError(error);
  }
}
