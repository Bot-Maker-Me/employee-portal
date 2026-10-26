"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "User accounts" },
  { href: "/admin/password-requests", label: "Password requests" },
];

/** Small sub-navigation shared by the three admin views. */
export function AdminNav({ pendingRequests = 0 }: { pendingRequests?: number }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Admin sections"
      className="flex flex-wrap gap-2 border-b border-line pb-4"
    >
      {ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "label-mono inline-flex items-center gap-2 rounded-btn border px-3 py-2 transition-colors",
              active
                ? "border-accent bg-accent-tint text-ink"
                : "border-line text-muted hover:border-accent hover:text-ink",
            )}
          >
            {item.label}
            {item.href === "/admin/password-requests" && pendingRequests > 0 && (
              <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] text-white">
                {pendingRequests}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
