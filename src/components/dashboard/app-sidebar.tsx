"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  Building2,
  Calendar,
  Contact,
  LayoutDashboard,
  MessageSquare,
  Rocket,
  Settings,
  Target,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { SidebarUserFooter } from "@/components/dashboard/sidebar-user-footer";
import { hasPermission } from "@/lib/auth/permissions";
import { hasOrgPermission } from "@/lib/tenant/scope";
import type { PermissionKey } from "@/lib/auth/permission-catalog";
import type { FeatureFlags } from "@/lib/features/flags";
import type { AuthUser } from "@/types/auth";

type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  anyOf?: PermissionKey[];
  children?: { title: string; href: string; anyOf?: PermissionKey[] }[];
};

interface AppSidebarProps {
  user: AuthUser;
  flags: FeatureFlags;
}

function canSee(
  user: AuthUser,
  anyOf?: PermissionKey[]
): boolean {
  if (!anyOf?.length) return true;
  return anyOf.some((p) => hasOrgPermission(user, p));
}

export function AppSidebar({ user, flags }: AppSidebarProps) {
  const pathname = usePathname();
  const showSettings = hasPermission(user.role, "settings:read");

  const primary: NavItem[] = [
    { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    {
      title: "Autopilot",
      href: "/dashboard/autopilot",
      icon: Rocket,
    },
    {
      title: "Leads",
      href: "/dashboard/companies",
      icon: Building2,
      anyOf: ["opportunities.view", "leads.view"],
      children: [
        {
          title: "Companies",
          href: "/dashboard/companies",
          anyOf: ["opportunities.view", "leads.view"],
        },
        {
          title: "Contacts",
          href: "/dashboard/contacts",
          anyOf: ["opportunities.view", "leads.view"],
        },
      ],
    },
    {
      title: "Campaigns",
      href: "/dashboard/campaigns",
      icon: Target,
      anyOf: ["campaigns.manage", "campaigns.view"],
      children: [
        {
          title: "All campaigns",
          href: "/dashboard/campaigns",
          anyOf: ["campaigns.manage", "campaigns.view"],
        },
        {
          title: "Sequences",
          href: "/dashboard/sequences",
          anyOf: ["sequences.view", "sequences.manage"],
        },
      ],
    },
    {
      title: "Inbox",
      href: "/dashboard/conversations",
      icon: MessageSquare,
      anyOf: ["conversations.view"],
    },
    {
      title: "Meetings",
      href: "/dashboard/meetings",
      icon: Calendar,
      anyOf: ["opportunities.view", "deals.manage"],
    },
    {
      title: "Pipeline",
      href: "/dashboard/pipeline",
      icon: Briefcase,
      anyOf: ["deals.manage", "opportunities.view"],
      children: [
        {
          title: "Board",
          href: "/dashboard/pipeline",
          anyOf: ["deals.manage", "opportunities.view"],
        },
        {
          title: "Opportunities",
          href: "/dashboard/opportunities",
          anyOf: ["opportunities.view"],
        },
        {
          title: "Proposals",
          href: "/dashboard/proposals",
          anyOf: ["deals.manage"],
        },
      ],
    },
  ];

  // Legacy nav only when flag on (routes still exist)
  if (flags.legacy_enabled) {
    primary.push({
      title: "Legacy Leads",
      href: "/dashboard/leads",
      icon: Contact,
      anyOf: ["leads.view"],
    });
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/dashboard" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Zap className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Delvix</span>
                <span className="truncate text-xs text-muted-foreground">
                  {user.organizationName || "Company workspace"}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {primary
                .filter((item) => canSee(user, item.anyOf))
                .map((item) => {
                  const childVisible =
                    item.children?.filter((c) => canSee(user, c.anyOf)) ?? [];
                  const active =
                    item.href === "/dashboard"
                      ? pathname === "/dashboard"
                      : pathname.startsWith(item.href) ||
                        childVisible.some((c) => pathname.startsWith(c.href));

                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        isActive={active && childVisible.length === 0}
                        tooltip={item.title}
                        render={<Link href={item.href} />}
                      >
                        <item.icon />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                      {childVisible.length > 0 ? (
                        <SidebarMenuSub>
                          {childVisible.map((child) => (
                            <SidebarMenuSubItem key={child.href}>
                              <SidebarMenuSubButton
                                isActive={
                                  child.href === "/dashboard/campaigns" ||
                                  child.href === "/dashboard/pipeline"
                                    ? pathname === child.href
                                    : pathname.startsWith(child.href)
                                }
                                render={<Link href={child.href} />}
                              >
                                <span>{child.title}</span>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      ) : null}
                    </SidebarMenuItem>
                  );
                })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {showSettings && (
          <SidebarGroup>
            <SidebarGroupLabel>Settings</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={pathname.startsWith("/dashboard/settings")}
                    tooltip="Settings"
                    render={<Link href="/dashboard/settings" />}
                  >
                    <Settings />
                    <span>Settings</span>
                  </SidebarMenuButton>
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        isActive={pathname.startsWith(
                          "/dashboard/business-brain"
                        )}
                        render={<Link href="/dashboard/business-brain" />}
                      >
                        <span>Business Brain</span>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        isActive={pathname.startsWith("/dashboard/icp")}
                        render={<Link href="/dashboard/icp" />}
                      >
                        <span>ICP</span>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        isActive={pathname.startsWith("/dashboard/services")}
                        render={<Link href="/dashboard/services" />}
                      >
                        <span>Services</span>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        isActive={pathname.startsWith(
                          "/dashboard/revenue-goals"
                        )}
                        render={<Link href="/dashboard/revenue-goals" />}
                      >
                        <span>Revenue Goals</span>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarUserFooter user={user} />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
