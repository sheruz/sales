"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronsUpDown, LogOut, Settings, Shield } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_LABELS, isSuperAdmin } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";
import type { AuthUser } from "@/types/auth";

interface UserNavProps {
  user: AuthUser;
  variant?: "header" | "sidebar";
}

export function UserNav({ user, variant = "header" }: UserNavProps) {
  const router = useRouter();
  const initials = `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();

  async function handleLogout() {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Logout failed");
      toast.success("Signed out successfully");
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("Failed to sign out");
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="User menu"
        className={cn(
          "inline-flex items-center justify-center rounded-full outline-none transition-colors",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "hover:bg-accent data-popup-open:bg-accent",
          variant === "header" && "h-9 w-9",
          variant === "sidebar" &&
            "h-auto w-full gap-2 rounded-md p-2 text-left hover:bg-sidebar-accent data-popup-open:bg-sidebar-accent"
        )}
      >
        <Avatar className={cn(variant === "header" ? "h-9 w-9" : "h-8 w-8")}>
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        {variant === "sidebar" && (
          <>
            <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">
                {user.firstName} {user.lastName}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {ROLE_LABELS[user.role]}
              </span>
            </div>
            <ChevronsUpDown className="ml-auto size-4 shrink-0 text-muted-foreground" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={variant === "sidebar" ? "start" : "end"}
        side={variant === "sidebar" ? "top" : "bottom"}
        className="w-56"
      >
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
            <p className="text-xs text-muted-foreground">
              {ROLE_LABELS[user.role]}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/dashboard/settings")}>
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </DropdownMenuItem>
        {isSuperAdmin(user.role) && (
          <DropdownMenuItem onClick={() => router.push("/dashboard/platform")}>
            <Shield className="mr-2 h-4 w-4" />
            Platform Admin
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
