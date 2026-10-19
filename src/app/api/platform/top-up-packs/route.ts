import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  requirePlatformRead,
  requireSuperAdminWrite,
} from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { topUpPackService } from "@/services/top-up-pack.service";

export async function GET(request: NextRequest) {
  try {
    await requirePlatformRead();
    const includeArchived =
      request.nextUrl.searchParams.get("includeArchived") === "1";
    const packs = await topUpPackService.list(includeArchived);
    return NextResponse.json(apiSuccess({ packs }));
  } catch (error) {
    return handleApiError(error);
  }
}

const createSchema = z.object({
  name: z.string().min(1).max(120),
  credits: z.number().int().positive(),
  price: z.number().nonnegative(),
  currency: z.string().max(8).optional(),
  sortOrder: z.number().int().optional(),
  reason: z.string().min(1).max(2000),
});

export async function POST(request: NextRequest) {
  try {
    const actor = await requireSuperAdminWrite();
    const body = createSchema.parse(await request.json());
    const pack = await topUpPackService.create({
      ...body,
      actorUserId: actor.id,
    });
    return NextResponse.json(apiSuccess(pack));
  } catch (error) {
    return handleApiError(error);
  }
}
