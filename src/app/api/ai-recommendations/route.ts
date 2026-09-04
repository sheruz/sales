import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AiRecommendationStatus } from "@prisma/client";
import { aiRecommendationService } from "@/services/ai-recommendation.service";
import {
  requireOrgPermission,
  requireAnyOrgPermission,
} from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

export async function GET(request: NextRequest) {
  try {
    const user = await requireOrgPermission("analytics.view");
    const today = request.nextUrl.searchParams.get("today") === "1";
    const status = request.nextUrl.searchParams.get(
      "status"
    ) as AiRecommendationStatus | null;
    const data = today
      ? await aiRecommendationService.listToday(user.organizationId)
      : await aiRecommendationService.list(
          user.organizationId,
          status ?? undefined
        );
    return NextResponse.json(apiSuccess(data));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAnyOrgPermission([
      "opportunities.update",
      "agent.view",
    ]);
    const body = await request.json().catch(() => ({}));
    const force = Boolean(body?.force);
    if (!force) {
      const existing = await aiRecommendationService.listToday(
        user.organizationId
      );
      if (existing.length > 0) {
        return NextResponse.json(
          apiSuccess({ cached: true, recommendations: existing })
        );
      }
    }
    const plan = await aiRecommendationService.generateDailyPlan(
      user.organizationId,
      user.id
    );
    return NextResponse.json(apiSuccess({ cached: false, ...plan }));
  } catch (error) {
    return handleApiError(error);
  }
}
