"use client";
import { appHome } from "@/lib/app-paths";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Briefcase,
  Building2,
  Calendar,
  ChevronsUpDown,
  Home,
  Inbox,
  Rocket,
  Send,
  Settings,
  type LucideIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { DelvixLogoMark } from "@/components/dashboard/delvix-logo";
import { SidebarUserFooter } from "@/components/dashboard/sidebar-user-footer";
import { SidebarCreditsMeter } from "@/components/dashboard/sidebar-credits-meter";
import { AutopilotStatusPill } from "@/components/dashboard/autopilot-status-pill";
import { hasOrgPermission } from "@/lib/tenant/scope";
import type { PermissionKey } from "@/lib/auth/permission-catalog";
import type { FeatureFlags } from "@/lib/features/flags";
import type { AuthUser } from "@/types/auth";
import type { AutopilotShellStatus } from "@/lib/autopilot/shell-status";
import { Suspense } from "react";

type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  anyOf?: PermissionKey[];
  match: (ctx: { pathname: string; tab: string | null }) => boolean;
};

interface AppSidebarProps {
  user: AuthUser;
  flags: FeatureFlags;
  autopilotStatus: AutopilotShellStatus;
  /** Real counts keyed by nav title (e.g. Inbox, Outreach). */
  navCounts?: Record<string, number>;
}

function canSee(user: AuthUser, anyOf?: PermissionKey[]): boolean {
  if (!anyOf?.length) return true;
  return anyOf.some((p) => hasOrgPermission(user, p));
}

const NAV: NavItem[] = [
  {
    title: "Home",
    href: appHome(),
    icon: Home,
    match: ({ pathname }) => pathname === appHome(),
  },
  {
    title: "Autopilot",
    href: appHome("/autopilot"),
    icon: Rocket,
    match: ({ pathname, tab }) =>
      pathname.startsWith(appHome("/autopilot")) &&
      tab !== "pitch" &&
      tab !== "pitches" &&
      tab !== "outbound",
  },
  {
    title: "Leads",
    href: appHome("/companies"),
    icon: Building2,
    anyOf: ["opportunities.view", "leads.view"],
    match: ({ pathname }) =>
      pathname.startsWith(appHome("/companies")) ||
      pathname.startsWith(appHome("/contacts")) ||
      pathname.startsWith(appHome("/leads")),
  },
  {
    title: "Outreach",
    href: appHome("/outreach"),
    icon: Send,
    anyOf: [
      "campaigns.manage",
      "campaigns.view",
      "sequences.view",
      "integrations.manage",
    ],
    match: ({ pathname, tab }) =>
      pathname.startsWith(appHome("/outreach")) ||
      pathname.startsWith(appHome("/sequences")) ||
      pathname.startsWith(appHome("/campaigns")) ||
      (pathname.startsWith(appHome("/autopilot")) &&
        (tab === "pitch" || tab === "pitches" || tab === "outbound")),
  },
  {
    title: "Inbox",
    href: appHome("/conversations"),
    icon: Inbox,
    anyOf: ["conversations.view"],
    match: ({ pathname }) => pathname.startsWith(appHome("/conversations")),
  },
  {
    title: "Deals",
    href: appHome("/pipeline"),
    icon: Briefcase,
    anyOf: ["deals.manage", "opportunities.view"],
    match: ({ pathname }) =>
      pathname.startsWith(appHome("/pipeline")) ||
      pathname.startsWith(appHome("/opportunities")) ||
      pathname.startsWith(appHome("/proposals")),
  },
  {
    title: "Meetings",
    href: appHome("/meetings"),
    icon: Calendar,
    anyOf: ["opportunities.view", "deals.manage"],
    match: ({ pathname }) => pathname.startsWith(appHome("/meetings")),
  },
];

function SidebarNav({
  user,
  navCounts,
}: {
  user: AuthUser;
  navCounts?: Record<string, number>;
}) {
  const pathname = usePathname();
  const search = useSearchParams();
  const tab = search.get("tab");

  return (
    <SidebarMenu>
      {NAV.filter((item) => canSee(user, item.anyOf)).map((item) => (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton
            isActive={item.match({ pathname, tab })}
            tooltip={item.title}
            render={<Link href={item.href} />}
          >
            <item.icon />
            <span>{item.title}</span>
          </SidebarMenuButton>
          {(navCounts?.[item.title] ?? 0) > 0 ? (
            <SidebarMenuBadge className="rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
              {navCounts![item.title]}
            </SidebarMenuBadge>
          ) : null}
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

export function AppSidebar({
  user,
  autopilotStatus,
  navCounts,
}: AppSidebarProps) {
  const pathname = usePathname();
  const workspace =
    user.organizationName?.trim() || "Set workspace name in Settings";

  return (
    <Sidebar collapsible="offcanvas" className="border-r border-sidebar-border">
      <SidebarHeader className="gap-3 border-b border-sidebar-border px-3 py-4">
        <Link href={appHome()} className="flex items-center gap-2.5 px-1">
          <DelvixLogoMark size={30} />
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[15px] font-bold tracking-tight text-sidebar-foreground">
              Delvix
            </div>
            <div className="font-mono text-[9.5px] tracking-[1.8px] text-muted-foreground">
              REVENUE OS
            </div>
          </div>
        </Link>
        <Link
          href={appHome("/settings")}
          title="Workspace settings"
          className="flex items-center justify-between gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-3 py-2 text-[13px] font-semibold text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
        >
          <span className="truncate">{workspace}</span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="px-2 py-3">
          <SidebarGroupContent>
            <Suspense fallback={<SidebarMenu />}>
              <SidebarNav user={user} navCounts={navCounts} />
            </Suspense>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-2 border-t border-sidebar-border p-3">
        <SidebarCreditsMeter />
        <AutopilotStatusPill status={autopilotStatus} />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={pathname.startsWith(appHome("/settings"))}
              tooltip="Settings"
              render={<Link href={appHome("/settings")} />}
            >
              <Settings />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarUserFooter user={user} />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
