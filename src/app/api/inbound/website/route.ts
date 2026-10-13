import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError } from "@/lib/api/error-handler";
import { isInboundSourceKey } from "@/lib/inbound/constants";
import {
  verifyInboundAuth,
  websiteInboundService,
} from "@/services/website-inbound.service";

export const runtime = "nodejs";

const bodySchema = z.object({
  source: z.string().refine(isInboundSourceKey, {
    message: 'source must be "website" or "autopilot_waitlist"',
  }),
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320),
  company: z.string().trim().max(300).optional(),
  website: z.string().trim().max(500).optional(),
  needs: z.array(z.string().max(80)).max(20).optional(),
  budget: z.string().trim().max(120).optional(),
  startTiming: z.string().trim().max(120).optional(),
  message: z.string().trim().max(8000).optional(),
  brief: z.string().trim().min(1).max(12000),
});

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const auth = verifyInboundAuth(request, rawBody);
    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized", code: "UNAUTHORIZED" } },
        { status: 401 }
      );
    }

    let json: unknown;
    try {
      json = JSON.parse(rawBody || "{}");
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: { message: "Invalid JSON", code: "VALIDATION_ERROR" },
        },
        { status: 400 }
      );
    }

    const payload = bodySchema.parse(json);
    const result = await websiteInboundService.ingest({
      ...payload,
      source: payload.source,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleApiError(error);
  }
}
