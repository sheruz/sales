import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdminWrite } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { websiteAgencyPlansService } from "@/services/website-agency-plans.service";

const patchSchema = z.object({
  kind: z.enum(["plan", "offer"]),
  slug: z.string().min(1).max(64).optional(),
  name: z.string().min(1).max(120).optional(),
  priceLabel: z.string().min(1).max(80).optional(),
  priceUnit: z.string().min(1).max(80).optional(),
  description: z.string().min(1).max(2000).optional(),
  includes: z.array(z.string().max(200)).max(20).optional(),
  ctaLabel: z.string().min(1).max(80).optional(),
  ctaHref: z.string().min(1).max(300).optional(),
  featured: z.boolean().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
  deliveryDays: z.number().int().min(1).max(365).nullable().optional(),
  href: z.string().max(300).nullable().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    await requireSuperAdminWrite();
    const { id } = await ctx.params;
    const body = patchSchema.parse(await request.json());
    if (body.kind === "plan") {
      const plan = await websiteAgencyPlansService.updatePlan(id, body);
      return NextResponse.json(apiSuccess({ plan }));
    }
    const offer = await websiteAgencyPlansService.updateOffer(id, body);
    return NextResponse.json(apiSuccess({ offer }));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  try {
    await requireSuperAdminWrite();
    const { id } = await ctx.params;
    const kind = request.nextUrl.searchParams.get("kind");
    if (kind !== "plan" && kind !== "offer") {
      return NextResponse.json(
        { success: false, error: { message: "kind=plan|offer required" } },
        { status: 400 }
      );
    }
    if (kind === "plan") {
      await websiteAgencyPlansService.deletePlan(id);
    } else {
      await websiteAgencyPlansService.deleteOffer(id);
    }
    return NextResponse.json(apiSuccess({ ok: true }));
  } catch (error) {
    return handleApiError(error);
  }
}
