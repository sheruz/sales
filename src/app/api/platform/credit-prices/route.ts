import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CreditKeyMode } from "@prisma/client";
import {
  requirePlatformRead,
  requireSuperAdminWrite,
} from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { creditPriceAdminService } from "@/services/credit-price-admin.service";

export async function GET() {
  try {
    await requirePlatformRead();
    const data = await creditPriceAdminService.list();
    return NextResponse.json(apiSuccess(data));
  } catch (error) {
    return handleApiError(error);
  }
}

const schema = z.object({
  actionType: z.string().min(1),
  keyMode: z.nativeEnum(CreditKeyMode),
  credits: z.number().int().nonnegative(),
  active: z.boolean().optional(),
  reason: z.string().min(1).max(2000),
});

export async function PUT(request: NextRequest) {
  try {
    const actor = await requireSuperAdminWrite();
    const body = schema.parse(await request.json());
    const row = await creditPriceAdminService.upsert({
      ...body,
      actorUserId: actor.id,
    });
    return NextResponse.json(apiSuccess(row));
  } catch (error) {
    return handleApiError(error);
  }
}
