/**
 * Meta Pixel ID from Super Admin PaymentSettings.business JSON.
 * No Prisma schema change — key: metaPixelId
 */
import prisma from "@/lib/db/prisma";

export async function getMetaPixelId(): Promise<string | null> {
  try {
    const row = await prisma.paymentSettings.findUnique({
      where: { id: "default" },
      select: { business: true },
    });
    const business =
      row?.business &&
      typeof row.business === "object" &&
      !Array.isArray(row.business)
        ? (row.business as Record<string, unknown>)
        : {};
    const id = business.metaPixelId;
    if (typeof id === "string" && /^\d{5,20}$/.test(id.trim())) {
      return id.trim();
    }
    return null;
  } catch {
    return null;
  }
}
