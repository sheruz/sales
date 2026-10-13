"use client";

import Link from "next/link";
import { toast } from "sonner";
import { LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import type { AuthUser } from "@/types/auth";

interface SidebarUserFooterProps {
  user: AuthUser;
  /** @deprecated Settings lives in sidebar footer; kept for platform console */
  settingsHref?: string;
}

function displayName(user: AuthUser): {
  name: string;
  needsProfile: boolean;
  initials: string;
} {
  const first = user.firstName?.trim() || "";
  const last = user.lastName?.trim() || "";
  const full = `${first} ${last}`.trim();
  if (!full) {
    return {
      name: "Set your name",
      needsProfile: true,
      initials: (user.email?.[0] || "?").toUpperCase(),
    };
  }
  const initials = `${first[0] || ""}${last[0] || first[1] || ""}`.toUpperCase() || "?";
  return { name: full, needsProfile: false, initials };
}

export function SidebarUserFooter({
  user,
  settingsHref = "/dashboard/settings?tab=profile",
}: SidebarUserFooterProps) {
  const { name, needsProfile, initials } = displayName(user);
  const role =
    (user.role && ROLE_LABELS[user.role]) ||
    user.organizationRoleKey?.replace(/_/g, " ") ||
    "Member";

  async function handleLogout() {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Logout failed");
      window.location.href = "/login";
    } catch {
      toast.error("Failed to sign out");
    }
  }

  return (
    <div className="flex w-full items-center gap-1">
      <Link
        href={settingsHref}
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-sidebar-accent"
      >
        <Avatar className="size-8 shrink-0">
          <AvatarFallback className="bg-primary text-xs text-primary-foreground">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 text-left text-[13px] leading-tight">
          <p
            className={
              needsProfile
                ? "truncate font-semibold"
                : "truncate font-semibold"
            }
            style={
              needsProfile
                ? { color: "var(--warning)" }
                : undefined
            }
          >
            {name}
          </p>
          <p className="truncate text-[12px] capitalize text-muted-foreground">
            {role}
          </p>
        </div>
      </Link>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={handleLogout}
        title="Sign out"
        type="button"
      >
        <LogOut className="size-4" />
      </Button>
    </div>
  );
}
