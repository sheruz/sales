import { getCurrentUser } from "@/lib/auth/session";
import { PackagesListClient } from "@/components/platform/packages-list-client";

export default async function PackagesPage() {
  const user = await getCurrentUser();
  const canWrite = user?.platformRole === "SUPER_ADMIN" || !!user?.isPlatformAdmin;
  return <PackagesListClient canWrite={canWrite} />;
}
