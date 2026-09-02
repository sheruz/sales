"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LogOut, Settings } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS, isSuperAdmin } from "@/lib/auth/permissions";
import type { AuthUser } from "@/types/auth";

interface SidebarUserFooterProps {
  user: AuthUser;
}

export function SidebarUserFooter({ user }: SidebarUserFooterProps) {
  const router = useRouter();
  const initials = `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();

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
    <div className="flex w-full flex-col gap-2 p-2">
      <div className="flex items-center gap-2 px-1">
        <Avatar className="size-8 shrink-0">
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 text-left text-sm leading-tight">
          <p className="truncate font-medium">
            {user.firstName} {user.lastName}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {ROLE_LABELS[user.role]}
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={() => router.push("/dashboard/settings")}
        >
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </Button>
        {isSuperAdmin(user.role) && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={() => router.push("/dashboard/platform")}
          >
            Platform Admin
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-destructive hover:text-destructive"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </div>
    </div>
  );
}
