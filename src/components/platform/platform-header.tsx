"use client";

import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { appOps } from "@/lib/app-paths";
import {
  type PlatformBillingEnv,
  platformBillingEnvLabel,
  writePlatformBillingEnvCookie,
} from "@/lib/platform/environment-preference";
import type { AuthUser } from "@/types/auth";
import { FormEvent, useState } from "react";

interface PlatformHeaderProps {
  user: AuthUser;
  billingEnv: PlatformBillingEnv;
}

export function PlatformHeader({ user, billingEnv }: PlatformHeaderProps) {
  const router = useRouter();
  const [q, setQ] = useState("");
  void user;

  function setEnv(next: PlatformBillingEnv) {
    writePlatformBillingEnvCookie(next);
    router.refresh();
  }

  function onSearch(e: FormEvent) {
    e.preventDefault();
    const term = q.trim();
    if (!term) {
      router.push(appOps("/companies"));
      return;
    }
    router.push(
      `${appOps("/companies")}?q=${encodeURIComponent(term)}`
    );
  }

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/88 px-3 backdrop-blur-md sm:gap-3 sm:px-4 md:px-7">
      <SidebarTrigger className="-ml-1 shrink-0" />

      <form
        onSubmit={onSearch}
        className="relative min-w-0 flex-1 md:mx-auto md:max-w-[440px]"
      >
        <Search className="pointer-events-none absolute top-1/2 left-3 size-[15px] -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search organizations…"
          className="h-[34px] border-border bg-card pl-9 text-[13px]"
          aria-label="Search organizations"
        />
      </form>

      <div className="flex shrink-0 items-center gap-2">
        <div
          className="flex items-center rounded-lg border border-border bg-card p-0.5"
          role="group"
          aria-label="Billing environment"
        >
          {(["production", "sandbox"] as const).map((env) => {
            const active = billingEnv === env;
            return (
              <Button
                key={env}
                type="button"
                size="sm"
                variant="ghost"
                className={cn(
                  "h-7 px-2.5 text-xs font-medium",
                  active &&
                    env === "production" &&
                    "bg-emerald-600/15 text-emerald-700 hover:bg-emerald-600/20 dark:text-emerald-300",
                  active &&
                    env === "sandbox" &&
                    "bg-amber-500/15 text-amber-800 hover:bg-amber-500/20 dark:text-amber-200"
                )}
                onClick={() => setEnv(env)}
              >
                {platformBillingEnvLabel(env)}
              </Button>
            );
          })}
        </div>
        <div className="grid size-[34px] place-items-center overflow-hidden rounded-lg border border-border bg-card">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
