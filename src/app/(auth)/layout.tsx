import { appHome } from "@/lib/app-paths";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (user) {
    redirect(appHome());
  }

  return <>{children}</>;
}
