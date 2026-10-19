import { getCurrentUser } from "@/lib/auth/session";
import { CreditPricesClient } from "@/components/platform/credit-prices-client";

export default async function CreditPricesPage() {
  const user = await getCurrentUser();
  const canWrite = user?.platformRole === "SUPER_ADMIN" || !!user?.isPlatformAdmin;
  return <CreditPricesClient canWrite={canWrite} />;
}
