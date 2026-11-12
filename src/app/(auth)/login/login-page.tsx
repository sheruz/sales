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
  const [totpCode, setTotpCode] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          ...(mfaRequired || totpCode.trim()
            ? { totpCode: totpCode.trim() }
            : {}),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        const code = data.error?.code as string | undefined;
        const message = data.error?.message ?? "Login failed";
        if (
          code === "MFA_REQUIRED" ||
          /authenticator code required/i.test(message)
        ) {
          setMfaRequired(true);
          setTotpCode("");
          toast.message("Enter your authenticator code to finish signing in");
          return;
        }
        throw new Error(message);
      }

      toast.success(`Welcome back, ${data.data.user.firstName}!`);
      const u = data.data.user as {
        role?: string;
        platformRole?: string | null;
        isPlatformAdmin?: boolean;
        isPlatformOperator?: boolean;
      };
      const isPlatform =
        u.isPlatformAdmin === true ||
        u.isPlatformOperator === true ||
        u.platformRole === "SUPER_ADMIN" ||
        u.platformRole === "PLATFORM_SUPPORT" ||
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
            <CardTitle>{mfaRequired ? "Two-factor authentication" : "Sign in"}</CardTitle>
            <CardDescription>
              {mfaRequired
                ? "Enter the 6-digit code from your authenticator app, or a recovery code"
                : "Enter your credentials to access the dashboard"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!mfaRequired ? (
                <>
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
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Signed in as <span className="font-medium text-foreground">{email}</span>
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="totp">Authenticator code</Label>
                    <Input
                      id="totp"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="123456"
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value)}
                      required
                      autoFocus
                      disabled={isLoading}
                    />
                  </div>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:underline"
                    onClick={() => {
                      setMfaRequired(false);
                      setTotpCode("");
                    }}
                  >
                    ← Use a different account
                  </button>
                </>
              )}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading
                  ? "Signing in..."
                  : mfaRequired
                    ? "Verify and sign in"
                    : "Sign in"}
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
