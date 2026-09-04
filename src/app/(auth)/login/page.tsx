import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { isSuperAdmin } from "@/lib/auth/permissions";
import LoginPage from "./login-page";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) {
    const params = await searchParams;
    const dest = params.redirect;
    if (isSuperAdmin(user.role)) {
      redirect(
        dest?.startsWith("/platform") ? dest : "/platform"
      );
    }
    if (dest?.startsWith("/dashboard")) {
      redirect(dest);
    }
    redirect("/dashboard");
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          Loading...
        </div>
      }
    >
      <LoginPage />
    </Suspense>
  );
}
