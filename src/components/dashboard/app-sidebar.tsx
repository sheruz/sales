"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  Brain,
  Briefcase,
  Building2,
  CircleDollarSign,
  Contact,
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
  Workflow,
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
  SidebarRail,
} from "@/components/ui/sidebar";
import { SidebarUserFooter } from "@/components/dashboard/sidebar-user-footer";
import { hasPermission } from "@/lib/auth/permissions";
import { hasOrgPermission } from "@/lib/tenant/scope";
import type { PermissionKey } from "@/lib/auth/permission-catalog";
import type { AuthUser } from "@/types/auth";

type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Org permission required (any of). Omit = always visible when logged in. */
  anyOf?: PermissionKey[];
};

const mainNav: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  {
    title: "Opportunities",
    href: "/dashboard/opportunities",
    icon: Flame,
    anyOf: ["opportunities.view"],
  },
  {
    title: "Companies",
    href: "/dashboard/companies",
    icon: Building2,
    anyOf: ["opportunities.view", "leads.view"],
  },
  {
    title: "Contacts",
    href: "/dashboard/contacts",
    icon: Contact,
    anyOf: ["opportunities.view", "leads.view"],
  },
  {
    title: "Pipeline",
    href: "/dashboard/pipeline",
    icon: Briefcase,
    anyOf: ["deals.manage", "opportunities.view"],
  },
  {
    title: "Leads",
    href: "/dashboard/leads",
    icon: Users,
    anyOf: ["leads.view"],
  },
  {
    title: "Campaigns",
    href: "/dashboard/campaigns",
    icon: Target,
    anyOf: ["campaigns.manage"],
  },
  {
    title: "Sequences",
    href: "/dashboard/sequences",
    icon: Workflow,
    anyOf: ["sequences.manage"],
  },
  {
    title: "Autopilot",
    href: "/dashboard/autopilot",
    icon: Rocket,
    anyOf: ["campaigns.manage", "agent.manage"],
  },
  {
    title: "Revenue Agent",
    href: "/dashboard/agent",
    icon: Bot,
    anyOf: ["agent.view"],
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
    icon: ListTodo,
    anyOf: ["opportunities.view", "deals.manage"],
  },
  {
    title: "Proposals",
    href: "/dashboard/proposals",
    icon: Package,
    anyOf: ["deals.manage"],
  },
  {
    title: "Tasks",
    href: "/dashboard/tasks",
    icon: ListTodo,
    anyOf: ["leads.view", "opportunities.view"],
  },
];

const revenueOsNav: NavItem[] = [
  {
    title: "Business Brain",
    href: "/dashboard/business-brain",
    icon: Brain,
    anyOf: ["business_brain.manage"],
  },
  {
    title: "Services",
    href: "/dashboard/services",
    icon: Package,
    anyOf: ["business_brain.manage"],
  },
  {
    title: "ICP",
    href: "/dashboard/icp",
    icon: Crosshair,
    anyOf: ["business_brain.manage"],
  },
  {
    title: "Revenue Goals",
    href: "/dashboard/revenue-goals",
    icon: CircleDollarSign,
    anyOf: ["revenue_goals.manage", "revenue.view"],
  },
  {
    title: "Sources",
    href: "/dashboard/sources",
    icon: Plug,
    anyOf: ["integrations.manage"],
  },
];

function canSee(user: AuthUser, item: NavItem): boolean {
  if (!item.anyOf?.length) return true;
  return item.anyOf.some((p) => hasOrgPermission(user, p));
}

interface AppSidebarProps {
  user: AuthUser;
}

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();

  const visibleMain = mainNav.filter((item) => canSee(user, item));
  const visibleRevenue = revenueOsNav.filter((item) => canSee(user, item));
  const showSettings = hasPermission(user.role, "settings:read");

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
                  {user.organizationName || "Company workspace"}
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
              {visibleMain.map((item) => (
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

        {visibleRevenue.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Revenue OS</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleRevenue.map((item) => (
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
        )}

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
