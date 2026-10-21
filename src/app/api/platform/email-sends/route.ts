import { NextRequest, NextResponse } from "next/server";
import { EmailSendStatus } from "@prisma/client";
import { requireSuperAdmin } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";
import { lifecycleEmailService } from "@/services/billing/lifecycle-email.service";
import prisma from "@/lib/db/prisma";

export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as EmailSendStatus | null;
    const templateKey = searchParams.get("templateKey") || undefined;
    const organizationId = searchParams.get("organizationId") || undefined;
    const q = searchParams.get("q")?.trim();
    const take = Math.min(Number(searchParams.get("take") || 50), 200);
    const skip = Math.max(Number(searchParams.get("skip") || 0), 0);

    const result = await lifecycleEmailService.listSends({
      organizationId,
      templateKey,
      status: status || undefined,
      take,
      skip,
    });

    // Optional filter by to-email substring (post-filter if q set)
    let rows = result.rows;
    let total = result.total;
    if (q) {
      const filtered = await prisma.emailSendLog.findMany({
        where: {
          ...(organizationId ? { organizationId } : {}),
          ...(templateKey ? { templateKey } : {}),
          ...(status ? { status } : {}),
          OR: [
            { toEmail: { contains: q, mode: "insensitive" } },
            { subject: { contains: q, mode: "insensitive" } },
            { eventKey: { contains: q, mode: "insensitive" } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take,
        skip,
        select: {
          id: true,
          organizationId: true,
          toEmail: true,
          templateKey: true,
          eventKey: true,
          status: true,
          attempts: true,
          providerMessageId: true,
          error: true,
          subject: true,
          sentAt: true,
          createdAt: true,
        },
      });
      total = await prisma.emailSendLog.count({
        where: {
          ...(organizationId ? { organizationId } : {}),
          ...(templateKey ? { templateKey } : {}),
          ...(status ? { status } : {}),
          OR: [
            { toEmail: { contains: q, mode: "insensitive" } },
            { subject: { contains: q, mode: "insensitive" } },
            { eventKey: { contains: q, mode: "insensitive" } },
          ],
        },
      });
      rows = filtered;
    }

    const orgIds = [
      ...new Set(rows.map((r) => r.organizationId).filter(Boolean)),
    ] as string[];
    const orgs =
      orgIds.length > 0
        ? await prisma.organization.findMany({
            where: { id: { in: orgIds } },
            select: { id: true, name: true },
          })
        : [];
    const orgMap = Object.fromEntries(orgs.map((o) => [o.id, o.name]));

    return NextResponse.json(
      apiSuccess({
        rows: rows.map((r) => ({
          ...r,
          organizationName: r.organizationId
            ? orgMap[r.organizationId] || null
            : null,
        })),
        total,
      })
    );
  } catch (error) {
    return handleApiError(error);
  }
}
