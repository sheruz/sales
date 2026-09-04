"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  BarChart3,
  Brain,
  Briefcase,
  CircleDollarSign,
  Crosshair,
  Flame,
  LayoutDashboard,
  ListTodo,
  MessageSquare,
  Package,
  Plug,
  Rocket,
  Settings,
  Target,
  Users,
  Zap,
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
  SidebarRail,
} from "@/components/ui/sidebar";
import { SidebarUserFooter } from "@/components/dashboard/sidebar-user-footer";
import { hasPermission } from "@/lib/auth/permissions";
import type { AuthUser } from "@/types/auth";

const mainNav = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Opportunities", href: "/dashboard/opportunities", icon: Flame },
  { title: "Pipeline", href: "/dashboard/pipeline", icon: Briefcase },
  { title: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { title: "Leads", href: "/dashboard/leads", icon: Users },
  { title: "Campaigns", href: "/dashboard/campaigns", icon: Target },
  { title: "Autopilot", href: "/dashboard/autopilot", icon: Rocket },
  { title: "Revenue Agent", href: "/dashboard/agent", icon: Bot },
  { title: "Inbox", href: "/dashboard/conversations", icon: MessageSquare },
  { title: "Meetings", href: "/dashboard/meetings", icon: ListTodo },
  { title: "Proposals", href: "/dashboard/proposals", icon: Package },
  { title: "Tasks", href: "/dashboard/tasks", icon: ListTodo },
];

const revenueOsNav = [
  { title: "Business Brain", href: "/dashboard/business-brain", icon: Brain },
  { title: "Services", href: "/dashboard/services", icon: Package },
  { title: "ICP", href: "/dashboard/icp", icon: Crosshair },
  { title: "Revenue Goals", href: "/dashboard/revenue-goals", icon: CircleDollarSign },
  { title: "Sources", href: "/dashboard/sources", icon: Plug },
];

const settingsNav = [
  {
    title: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    permission: "settings:read" as const,
  },
];

interface AppSidebarProps {
  user: AuthUser;
}

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();

  const filteredSettings = settingsNav.filter(
    (item) => !item.permission || hasPermission(user.role, item.permission)
  );

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
                <span className="truncate font-semibold">Sales Platform</span>
                <span className="truncate text-xs text-muted-foreground">
                  Company workspace
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={
                      item.href === "/dashboard"
                        ? pathname === "/dashboard"
                        : pathname.startsWith(item.href)
                    }
                    tooltip={item.title}
                    render={<Link href={item.href} />}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Revenue OS</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {revenueOsNav.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={pathname.startsWith(item.href)}
                    tooltip={item.title}
                    render={<Link href={item.href} />}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredSettings.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={pathname.startsWith(item.href)}
                    tooltip={item.title}
                    render={<Link href={item.href} />}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarUserFooter user={user} />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
