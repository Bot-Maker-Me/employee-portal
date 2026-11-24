"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Database,
  Home,
  ListChecks,
  MessagesSquare,
  ShieldCheck,
  Users,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FeatureFlags } from "@/lib/features";

type NavItem = {
  href: string;
  label: string;
  short: string;
  icon: LucideIcon;
  feature?: keyof FeatureFlags;
  adminOnly?: boolean;
  /** Hidden from the compact mobile tab bar (still linked from Home). */
  desktopOnly?: boolean;
  /** Only on the mobile tab bar (the sidebar lists pharmacies individually). */
  mobileOnly?: boolean;
};

export type NavPharmacy = { id: string; name: string };

const ITEMS: NavItem[] = [
  { href: "/home", label: "Home", short: "Home", icon: Home },
  {
    href: "/drugs",
    label: "Drug Database",
    short: "Drugs",
    icon: Database,
    desktopOnly: true,
  },
  {
    href: "/interventions",
    label: "Intervention Codes",
    short: "Codes",
    icon: ListChecks,
    desktopOnly: true,
  },
  {
    href: "/pharmacies",
    label: "Pharmacies",
    short: "Sites",
    icon: Building2,
    mobileOnly: true,
  },
  {
    href: "/pharmacy",
    label: "Pharmacy Chat",
    short: "Pharmacy",
    icon: MessagesSquare,
    feature: "employee_pharmacy_topics",
  },
  {
    href: "/team",
    label: "Team Chat",
    short: "Team",
    icon: Users,
    feature: "employee_team_chat",
  },
  { href: "/account", label: "Account", short: "Account", icon: UserCog },
  {
    href: "/admin",
    label: "Admin",
    short: "Admin",
    icon: ShieldCheck,
    adminOnly: true,
  },
];

function visibleItems(
  flags: FeatureFlags,
  isAdmin: boolean,
  surface: "sidebar" | "tabbar",
) {
  return ITEMS.filter(
    (item) =>
      (!item.feature || flags[item.feature]) &&
      (!item.adminOnly || isAdmin) &&
      !(surface === "sidebar" && item.mobileOnly) &&
      !(surface === "tabbar" && item.desktopOnly),
  );
}

function SidebarLink({
  href,
  label,
  icon: Icon,
  active,
  badge = 0,
  nested = false,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  badge?: number;
  nested?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-btn px-3 py-2.5 text-[14px] transition-all duration-200 ease-out hover:translate-x-0.5",
        nested && "py-2 pl-4 text-[13.5px]",
        active
          ? "bg-accent-tint text-ink"
          : "text-muted hover:bg-raised hover:text-ink",
      )}
    >
      {active && (
        <span
          className="absolute left-0 top-1/2 h-5 w-[2px] animate-scale-in -translate-y-1/2 rounded-full bg-accent"
          aria-hidden="true"
        />
      )}
      <Icon
        className={cn(
          "h-[18px] w-[18px] shrink-0 transition-transform duration-200 ease-out group-hover:scale-110",
          nested && "h-4 w-4",
          active ? "text-accent-soft" : "text-muted",
        )}
        aria-hidden="true"
      />
      <span className="flex-1 truncate">{label}</span>
      {badge > 0 && (
        <span className="label-mono min-w-[18px] rounded-full bg-accent px-1.5 py-0.5 text-center text-white">
          {badge}
        </span>
      )}
    </Link>
  );
}

export function PortalSidebar({
  flags,
  badges = {},
  isAdmin = false,
  pharmacies = [],
}: {
  flags: FeatureFlags;
  badges?: Record<string, number>;
  isAdmin?: boolean;
  pharmacies?: NavPharmacy[];
}) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);
  const items = visibleItems(flags, isAdmin, "sidebar");
  // Reference items, then the pharmacy group, then everything else.
  const reference = items.filter((item) =>
    ["/home", "/drugs", "/interventions"].includes(item.href),
  );
  const rest = items.filter((item) => !reference.includes(item));

  return (
    <nav className="flex flex-col gap-1" aria-label="Primary">
      {reference.map((item) => (
        <SidebarLink
          key={item.href}
          href={item.href}
          label={item.label}
          icon={item.icon}
          active={isActive(item.href)}
          badge={badges[item.href]}
        />
      ))}

      {pharmacies.length > 0 && (
        <div className="mt-3 flex flex-col gap-0.5">
          <Link
            href="/pharmacies"
            className="label-mono px-3 pb-1 pt-1 text-muted/80 transition-colors hover:text-ink"
          >
            Pharmacies
          </Link>
          {pharmacies.map((pharmacy) => (
            <SidebarLink
              key={pharmacy.id}
              href={`/pharmacies/${pharmacy.id}`}
              label={pharmacy.name}
              icon={Building2}
              active={isActive(`/pharmacies/${pharmacy.id}`)}
              nested
            />
          ))}
        </div>
      )}

      <div className={cn("flex flex-col gap-1", pharmacies.length > 0 && "mt-3")}>
        {rest.map((item) => (
          <SidebarLink
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            active={isActive(item.href)}
            badge={badges[item.href]}
          />
        ))}
      </div>
    </nav>
  );
}

export function PortalTabBar({
  flags,
  badges = {},
  isAdmin = false,
}: {
  flags: FeatureFlags;
  badges?: Record<string, number>;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();

  return (
    <nav
      className="sticky bottom-0 z-20 flex border-t border-line bg-bg/95 backdrop-blur"
      aria-label="Primary"
    >
      {visibleItems(flags, isAdmin, "tabbar").map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        const badge = badges[item.href] ?? 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex flex-1 flex-col items-center gap-1 px-1 py-2.5 transition-all duration-200 ease-out active:scale-95",
              active ? "text-ink" : "text-muted",
            )}
          >
            {active && (
              <span
                className="absolute top-0 h-0.5 w-8 animate-scale-in rounded-full bg-accent"
                aria-hidden="true"
              />
            )}
            <Icon
              className={cn(
                "h-5 w-5 transition-transform duration-200 ease-out",
                active && "scale-110 text-accent-soft",
              )}
              aria-hidden="true"
            />
            <span className="label-mono text-[10px]">{item.short}</span>
            {badge > 0 && (
              <span className="absolute right-1/4 top-1.5 h-2 w-2 animate-pulse-dot rounded-full bg-accent" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
