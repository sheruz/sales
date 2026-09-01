import { NextRequest, NextResponse } from "next/server";
import { automationService } from "@/services/automation.service";
import { autopilotService } from "@/services/autopilot.service";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const [automation, autopilot] = await Promise.all([
      automationService.processPendingJobs(),
      autopilotService.runAllEnabled(),
    ]);

    return NextResponse.json(apiSuccess({ automation, autopilot }));
  } catch (error) {
    return handleApiError(error);
  }
}
