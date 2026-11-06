import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  requirePlatformRead,
  requireSuperAdminWrite,
} from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { websiteAgencyPlansService } from "@/services/website-agency-plans.service";

export async function GET() {
  try {
    await requirePlatformRead();
    const data = await websiteAgencyPlansService.listAll();
    return NextResponse.json(apiSuccess(data));
  } catch (error) {
    return handleApiError(error);
  }
}

const planSchema = z.object({
  kind: z.literal("plan"),
  slug: z.string().min(1).max(64),
  name: z.string().min(1).max(120),
  priceLabel: z.string().min(1).max(80),
  priceUnit: z.string().min(1).max(80),
  description: z.string().min(1).max(2000),
  includes: z.array(z.string().max(200)).max(20),
  ctaLabel: z.string().min(1).max(80),
  ctaHref: z.string().min(1).max(300),
  featured: z.boolean().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
});

const offerSchema = z.object({
  kind: z.literal("offer"),
  name: z.string().min(1).max(120),
  priceLabel: z.string().min(1).max(80),
  description: z.string().min(1).max(2000),
  deliveryDays: z.number().int().min(1).max(365).nullable().optional(),
  href: z.string().max(300).nullable().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
});

const createSchema = z.discriminatedUnion("kind", [planSchema, offerSchema]);

export async function POST(request: NextRequest) {
  try {
    await requireSuperAdminWrite();
    const body = createSchema.parse(await request.json());
    if (body.kind === "plan") {
      const plan = await websiteAgencyPlansService.createPlan(body);
      return NextResponse.json(apiSuccess({ plan }));
    }
    const offer = await websiteAgencyPlansService.createOffer(body);
    return NextResponse.json(apiSuccess({ offer }));
  } catch (error) {
    return handleApiError(error);
  }
}
