"use client";

import { Search, Bell } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import type { AuthUser } from "@/types/auth";

interface DashboardHeaderProps {
  user: AuthUser;
  title?: string;
}

export function DashboardHeader({ user }: DashboardHeaderProps) {
  void user;
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/88 px-3 backdrop-blur-md sm:gap-3 sm:px-4 md:px-7">
      <SidebarTrigger className="-ml-1 shrink-0" />
      <div className="relative min-w-0 flex-1 md:mx-auto md:max-w-[440px]">
        <button
          type="button"
          className="flex h-[34px] w-full min-w-0 items-center gap-2 overflow-hidden rounded-lg border border-border bg-card px-3 text-[13px] text-muted-foreground"
          onClick={() => {
            /* ⌘K wired in R4 */
          }}
        >
          <Search className="size-[15px] shrink-0" />
          <span className="truncate">Search companies, contacts, deals</span>
          <kbd className="ml-auto hidden shrink-0 rounded border border-border px-1.5 font-mono text-[11px] sm:inline">
            ⌘K
          </kbd>
        </button>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          className="relative grid size-[34px] place-items-center rounded-lg border border-border bg-card text-muted-foreground"
          title="Notifications (coming soon)"
        >
          <Bell className="size-4" />
          <span className="absolute top-1.5 right-1.5 size-[7px] rounded-full bg-[#ff6b3d]" />
        </button>
        <div className="grid size-[34px] place-items-center overflow-hidden rounded-lg border border-border bg-card">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
