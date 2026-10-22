"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MessagesSquare, Users, UserCog, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FeatureFlags } from "@/lib/features";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** When set, the item is hidden if the matching feature flag is OFF. */
  feature?: keyof FeatureFlags;
  badge?: number;
};

const ITEMS: NavItem[] = [
  { href: "/home", label: "Home", icon: Home },
  {
    href: "/pharmacy",
    label: "Pharmacy Topics",
    icon: MessagesSquare,
    feature: "employee_pharmacy_topics",
  },
  { href: "/team", label: "Team Chat", icon: Users, feature: "employee_team_chat" },
  { href: "/account", label: "Account", icon: UserCog },
];

function useVisibleItems(flags: FeatureFlags) {
  return ITEMS.filter((item) => !item.feature || flags[item.feature]);
}

/** Desktop sidebar. */
export function PortalSidebar({ flags }: { flags: FeatureFlags }) {
  const pathname = usePathname();
  const items = useVisibleItems(flags);

  return (
    <nav className="flex flex-col gap-1" aria-label="Primary">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-btn px-3 py-2.5 text-[14px] transition-colors",
              active
                ? "bg-accent-tint text-ink"
                : "text-muted hover:bg-raised hover:text-ink",
            )}
          >
            <Icon
              className={cn("h-[18px] w-[18px]", active ? "text-accent-soft" : "text-muted")}
              aria-hidden="true"
            />
            <span className="flex-1 truncate">{item.label}</span>
            {typeof item.badge === "number" && item.badge > 0 && (
              <span className="label-mono min-w-[18px] rounded-full bg-accent px-1.5 py-0.5 text-center text-white">
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

/** Mobile bottom tab bar. */
export function PortalTabBar({ flags }: { flags: FeatureFlags }) {
  const pathname = usePathname();
  const items = useVisibleItems(flags);

  return (
    <nav
      className="sticky bottom-0 z-20 flex border-t border-line bg-bg/95 backdrop-blur"
      aria-label="Primary"
    >
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex flex-1 flex-col items-center gap-1 px-1 py-2.5",
              active ? "text-ink" : "text-muted",
            )}
          >
            <Icon
              className={cn("h-5 w-5", active && "text-accent-soft")}
              aria-hidden="true"
            />
            <span className="label-mono text-[10px]">{item.label.split(" ")[0]}</span>
            {typeof item.badge === "number" && item.badge > 0 && (
              <span className="absolute right-1/4 top-1.5 h-2 w-2 rounded-full bg-accent" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
