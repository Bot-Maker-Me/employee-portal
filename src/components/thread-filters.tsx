"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/topics";
import { cn } from "@/lib/utils";

const STATUSES = [
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "all", label: "All" },
] as const;

export function ThreadFilters({
  status,
  category,
  unread,
  search,
}: {
  status: string;
  category: string;
  unread: boolean;
  search: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [term, setTerm] = useState(search);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setTerm(search);
  }, [search]);

  function push(next: {
    status?: string;
    category?: string;
    unread?: boolean;
    q?: string;
  }) {
    const resolved = {
      status: next.status ?? status,
      category: next.category ?? category,
      unread: next.unread ?? unread,
      q: next.q ?? term,
    };
    const params = new URLSearchParams();
    if (resolved.status && resolved.status !== "open") params.set("status", resolved.status);
    if (resolved.category && resolved.category !== "all") params.set("category", resolved.category);
    if (resolved.unread) params.set("unread", "1");
    if (resolved.q.trim()) params.set("q", resolved.q.trim());
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function onSearchChange(value: string) {
    setTerm(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => push({ q: value }), 350);
  }

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          aria-hidden="true"
        />
        <input
          value={term}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search chats"
          aria-label="Search chats"
          className="w-full rounded-btn border border-line bg-sunken py-2.5 pl-9 pr-3 text-[15px] text-ink placeholder:text-muted/60 focus:border-accent focus:outline-none"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-btn border border-line p-0.5">
          {STATUSES.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => push({ status: item.value })}
              aria-pressed={status === item.value}
              className={cn(
                "label-mono rounded-[2px] px-3 py-1.5 transition-colors",
                status === item.value
                  ? "bg-accent-tint text-ink"
                  : "text-muted hover:text-ink",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        <select
          aria-label="Filter by category"
          value={category}
          onChange={(event) => push({ category: event.target.value })}
          className="label-mono rounded-btn border border-line bg-sunken px-2.5 py-1.5 text-muted focus:border-accent focus:outline-none"
        >
          <option value="all">All categories</option>
          {CATEGORY_ORDER.map((key) => (
            <option key={key} value={key}>
              {CATEGORY_LABELS[key]}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => push({ unread: !unread })}
          aria-pressed={unread}
          className={cn(
            "label-mono rounded-btn border px-3 py-1.5 transition-colors",
            unread
              ? "border-accent bg-accent-tint text-accent-soft"
              : "border-line text-muted hover:text-ink",
          )}
        >
          Unread only
        </button>
      </div>
    </div>
  );
}
