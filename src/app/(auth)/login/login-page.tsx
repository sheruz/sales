"use client";
import { appHome, appOps, modernizeAppPath } from "@/lib/app-paths";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { DelvixLogoMark } from "@/components/dashboard/delvix-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = modernizeAppPath(
    searchParams.get("redirect") ?? appHome()
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message ?? "Login failed");
      }

      toast.success(`Welcome back, ${data.data.user.firstName}!`);
      const u = data.data.user as {
        role?: string;
        platformRole?: string | null;
        isPlatformAdmin?: boolean;
      };
      const isPlatform =
        u.isPlatformAdmin === true ||
        u.platformRole === "SUPER_ADMIN" ||
        u.role === "SUPER_ADMIN";
      let home = redirect;
      if (isPlatform) {
        home =
          !redirect || redirect === appHome() || redirect.startsWith(appHome())
            ? appOps()
            : redirect;
      } else if (redirect.startsWith(appOps())) {
        home = appHome();
      }
      router.push(home);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Invalid email or password"
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center space-y-2 text-center">
          <DelvixLogoMark size={40} />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Delvix</h1>
            <p className="font-mono text-[10px] tracking-[1.8px] text-muted-foreground">
              REVENUE OS
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Sign in to your account to continue
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>
              Enter your credentials to access the dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@salesplatform.local"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-muted-foreground hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  disabled={isLoading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          No account?{" "}
          <Link href="/signup" className="hover:underline">
            Sign up
          </Link>
          {" · "}
          <Link href="/" className="hover:underline">
            Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
