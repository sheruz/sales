import { getCurrentUser } from "@/lib/auth/session";
import { PlatformOutreachClient } from "@/components/platform/platform-outreach-client";

export default async function PlatformOutreachPage() {
  const user = await getCurrentUser();
  const canWrite =
    user?.platformRole === "SUPER_ADMIN" || !!user?.isPlatformAdmin;
  return <PlatformOutreachClient canWrite={canWrite} />;
}
