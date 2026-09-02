import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { autopilotService } from "@/services/autopilot.service";
import { assertAutopilotCanRun } from "@/lib/autopilot\limits";
import { requirePermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

const updateSchema = z.object({
  isEnabled: z.boolean().optional(),
  goal: z.string().max(2000).optional(),
  targetJobTitles: z.array(z.string()).optional(),
  targetIndustries: z.array(z.string()).optional(),
  targetCountries: z.array(z.string()).optional(),
  dailySearchLimit: z.coerce.number().min(1).max(25).optional(),
  dailyMessageLimit: z.coerce.number().min(1).max(25).optional(),
  maxLeadsPerRun: z.coerce.number().min(1).max(25).optional(),
  maxLeadsPerDay: z.coerce.number().min(1).max(50).optional(),
  maxAiCallsPerDay: z.coerce.number().min(10).max(100).optional(),
  autoCreateCampaigns: z.boolean().optional(),
  serviceId: z.string().uuid().optional(),
});

export async function GET() {
  try {
    const user = await requirePermission("ai:use");
    const [config, usage] = await Promise.all([
      autopilotService.getOrCreateConfig(user.id),
      autopilotService.getUsage(user.id),
    ]);
    return NextResponse.json(apiSuccess({ ...config, usage }));
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

    await assertAutopilotCanRun(user.id);

    const existing = await autopilotService.getOrCreateConfig(user.id);
    const lastResult = existing.lastRunResult as { status?: string } | null;
    if (lastResult?.status === "running") {
      return NextResponse.json(
        apiSuccess({ started: false, message: "Autopilot is already running" }),
        { status: 409 }
      );
    }

    await prisma.autopilotConfig.update({
      where: { userId: user.id },
      data: {
        lastRunResult: {
          status: "running",
          startedAt: new Date().toISOString(),
        },
      },
    });

    autopilotService.run(user.id).catch(async (err) => {
      console.error("Autopilot run failed:", err);
      await prisma.autopilotConfig.update({
        where: { userId: user.id },
        data: {
          lastRunResult: {
            status: "failed",
            error: err instanceof Error ? err.message : "Autopilot failed",
            finishedAt: new Date().toISOString(),
          },
        },
      });
    });

    return NextResponse.json(
      apiSuccess({
        started: true,
        message: "Autopilot started. This may take 2–5 minutes. Refresh to see results.",
      }),
      { status: 202 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
