import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { notificationService } from "@/services/notification.service";
import { requireOrganizationContext } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

export async function GET(request: NextRequest) {
  try {
    const user = await requireOrganizationContext();
    const sp = request.nextUrl.searchParams;
    const unreadOnly = sp.get("unread") === "1";
    const take = Number(sp.get("take") ?? 30);
    const items = await notificationService.listForUser(
      user.organizationId,
      user.id,
      { unreadOnly, take: Number.isFinite(take) ? take : 30 }
    );
    const unread = items.filter((n) => !n.readAt).length;
    return NextResponse.json(apiSuccess({ items, unread }));
  } catch (error) {
    return handleApiError(error);
  }
}

const patchSchema = z.object({
  /** Omit to mark every unread notification as read */
  id: z.string().min(1).optional(),
});

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireOrganizationContext();
    const { id } = patchSchema.parse(await request.json().catch(() => ({})));
    const res = await notificationService.markRead(
      user.organizationId,
      user.id,
      id
    );
    return NextResponse.json(apiSuccess({ updated: res.count }));
  } catch (error) {
    return handleApiError(error);
  }
}
