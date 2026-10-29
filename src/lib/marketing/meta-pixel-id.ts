/**
 * Meta Pixel ID from Super Admin PaymentSettings.business JSON.
 * No Prisma schema change — key: metaPixelId
 *
 * Hard-timeout so marketing pages never hang when the DB is unreachable
 * (Prisma's default connect wait can stall TTFB for tens of seconds).
 */
import prisma from "@/lib/db/prisma";

const PIXEL_LOOKUP_MS = 1500;

export async function getMetaPixelId(): Promise<string | null> {
  try {
    const row = await Promise.race([
      prisma.paymentSettings.findUnique({
        where: { id: "default" },
        select: { business: true },
      }),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), PIXEL_LOOKUP_MS)
      ),
    ]);
    if (!row) return null;
    const business =
      row.business &&
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
