import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { OnboardingWizardClient } from "@/components/onboarding/onboarding-wizard-client";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.organizationId) redirect("/login");

  return <OnboardingWizardClient />;
}
