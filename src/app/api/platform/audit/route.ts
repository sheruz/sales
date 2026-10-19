import { NextRequest, NextResponse } from "next/server";
import { requirePlatformRead } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import prisma from "@/lib/db/prisma";

export async function GET(request: NextRequest) {
  try {
    await requirePlatformRead();
    const sp = request.nextUrl.searchParams;
    const organizationId = sp.get("organizationId") || undefined;
    const actorUserId = sp.get("actorUserId") || undefined;
    const action = sp.get("action") || undefined;
    const from = sp.get("from");
    const to = sp.get("to");
    const take = Math.min(200, Math.max(1, Number(sp.get("limit") || 50)));

    const rows = await prisma.platformAuditLog.findMany({
      where: {
        ...(organizationId ? { organizationId } : {}),
        ...(actorUserId ? { actorUserId } : {}),
        ...(action ? { action: { contains: action, mode: "insensitive" } } : {}),
        ...(from || to
          ? {
              createdAt: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take,
      include: {
        actor: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        organization: { select: { id: true, name: true, slug: true } },
      },
    });

    return NextResponse.json(apiSuccess({ logs: rows }));
  } catch (error) {
    return handleApiError(error);
  }
}
