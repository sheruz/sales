import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

export async function GET() {
  try {
    await requirePermission("campaigns:read");
    const services = await prisma.service.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        targetClientType: true,
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(apiSuccess(services));
  } catch (error) {
    return handleApiError(error);
  }
}
