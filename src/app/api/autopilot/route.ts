import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { autopilotService } from "@/services/autopilot.service";
import { requirePermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

const updateSchema = z.object({
  isEnabled: z.boolean().optional(),
  goal: z.string().max(2000).optional(),
  targetJobTitles: z.array(z.string()).optional(),
  targetIndustries: z.array(z.string()).optional(),
  targetCountries: z.array(z.string()).optional(),
  dailySearchLimit: z.coerce.number().min(1).max(100).optional(),
  dailyMessageLimit: z.coerce.number().min(1).max(100).optional(),
  autoCreateCampaigns: z.boolean().optional(),
  serviceId: z.string().uuid().optional(),
});

export async function GET() {
  try {
    const user = await requirePermission("ai:use");
    const config = await autopilotService.getOrCreateConfig(user.id);
    return NextResponse.json(apiSuccess(config));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requirePermission("ai:use");
    const body = await request.json();
    const input = updateSchema.parse(body);
    const config = await autopilotService.updateConfig(user.id, input);
    return NextResponse.json(apiSuccess(config));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST() {
  try {
    const user = await requirePermission("ai:use");
    const result = await autopilotService.run(user.id);
    return NextResponse.json(apiSuccess(result));
  } catch (error) {
    return handleApiError(error);
  }
}
