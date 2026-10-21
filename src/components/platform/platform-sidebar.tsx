"use client";
import { appOps } from "@/lib/app-paths";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  LayoutDashboard,
  Settings,
  Shield,
  Users,
  Package,
  Coins,
  Gift,
  ScrollText,
  CreditCard,
  FileText,
  Receipt,
  Mail,
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
import type { AuthUser } from "@/types/auth";

type NavItem = {
  title: string;
  href: string;
  icon: typeof LayoutDashboard;
};

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Dashboard",
    items: [{ title: "Overview", href: appOps(), icon: LayoutDashboard }],
  },
  {
    label: "Customers",
    items: [
      { title: "Organizations", href: appOps("/companies"), icon: Building2 },
      { title: "Users", href: appOps("/users"), icon: Users },
    ],
  },
  {
    label: "Billing",
    items: [
      { title: "Packages", href: appOps("/packages"), icon: Package },
      { title: "Credit prices", href: appOps("/credit-prices"), icon: Coins },
      { title: "Top-ups", href: appOps("/top-ups"), icon: Gift },
      { title: "Payments", href: appOps("/payments"), icon: CreditCard },
      { title: "Transactions", href: appOps("/transactions"), icon: Receipt },
      { title: "Invoices", href: appOps("/invoices"), icon: FileText },
    ],
  },
  {
    label: "System",
    items: [
      { title: "Email templates", href: appOps("/emails"), icon: Mail },
      { title: "Audit", href: appOps("/audit"), icon: ScrollText },
      { title: "Settings", href: appOps("/settings"), icon: Settings },
    ],
  },
];

interface PlatformSidebarProps {
  user: AuthUser;
}

export function PlatformSidebar({ user }: PlatformSidebarProps) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href={appOps()} />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Shield className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Platform Admin</span>
                <span className="truncate text-xs text-muted-foreground">
                  Super Admin control
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={
                        item.href === appOps()
                          ? pathname === appOps()
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
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarUserFooter user={user} settingsHref={appOps("/settings")} />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
