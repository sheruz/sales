import { getCurrentUser } from "@/lib/auth/session";
import { TopUpPacksClient } from "@/components/platform/top-up-packs-client";

export default async function TopUpsPage() {
  const user = await getCurrentUser();
  const canWrite = user?.platformRole === "SUPER_ADMIN" || !!user?.isPlatformAdmin;
  return <TopUpPacksClient canWrite={canWrite} />;
}
