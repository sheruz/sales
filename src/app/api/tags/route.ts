import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

export async function GET() {
  try {
    await requirePermission("leads:read");
    const tags = await prisma.tag.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json(apiSuccess(tags));
  } catch (error) {
    return handleApiError(error);
  }
}
