import { getCurrentUser } from "@/lib/auth/session";
import { PaymentsSettingsClient } from "@/components/platform/payments-settings-client";

export default async function PaymentsPage() {
  const user = await getCurrentUser();
  const canWrite =
    user?.platformRole === "SUPER_ADMIN" || !!user?.isPlatformAdmin;
  return <PaymentsSettingsClient canWrite={canWrite} />;
}
