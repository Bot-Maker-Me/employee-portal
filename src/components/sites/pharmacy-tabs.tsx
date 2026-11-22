"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BellRing, BookOpen, MessagesSquare, Pill, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS: { slug: string; label: string; icon: LucideIcon }[] = [
  { slug: "notices", label: "Notices & Reminders", icon: BellRing },
  { slug: "policies", label: "Policies & Procedures", icon: BookOpen },
  { slug: "chat", label: "Chat with Pharmacy", icon: MessagesSquare },
  { slug: "formulary", label: "Formulary", icon: Pill },
];

export function PharmacyTabs({ pharmacyId }: { pharmacyId: string }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Pharmacy sections"
      className="scroll-slim -mx-1 flex gap-2 overflow-x-auto border-b border-line px-1 pb-4"
    >
      {TABS.map((tab) => {
        const href = `/pharmacies/${pharmacyId}/${tab.slug}`;
        const active = pathname === href || pathname.startsWith(`${href}/`);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.slug}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "label-mono inline-flex shrink-0 items-center gap-2 rounded-btn border px-3 py-2 transition-colors",
              active
                ? "border-accent bg-accent-tint text-ink"
                : "border-line text-muted hover:border-accent hover:text-ink",
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
