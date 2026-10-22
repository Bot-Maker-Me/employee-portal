"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Users } from "lucide-react";
import { UnreadBadge } from "@/components/topic-badges";
import { formatStamp } from "@/lib/format";
import type { ChannelSummary } from "@/lib/channels";

export function ChannelList({ summaries }: { summaries: ChannelSummary[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return summaries;
    return summaries.filter((s) => s.label.toLowerCase().includes(q));
  }, [query, summaries]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          aria-hidden="true"
        />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search chats"
          aria-label="Search chats"
          className="w-full rounded-btn border border-line bg-sunken py-2.5 pl-9 pr-3 text-[15px] text-ink placeholder:text-muted/60 focus:border-accent focus:outline-none"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-ledger border border-line bg-raised p-6 text-center">
          <p className="text-[14px] text-muted">
            {summaries.length === 0
              ? "No chats yet. Start one with a colleague."
              : "No chats match your search."}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-ledger border border-line bg-raised">
          {filtered.map((item) => (
            <li key={item.channel.id}>
              <Link
                href={`/team/${item.channel.id}`}
                className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-sunken"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-serif text-lg text-ink">
                      {item.label}
                    </span>
                    {item.channel.type === "group" && (
                      <span className="label-mono inline-flex items-center gap-1 text-muted">
                        <Users className="h-3 w-3" aria-hidden="true" />
                        {item.memberCount}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-[13px] text-muted">
                    {item.lastPreview ?? "No messages yet"}
                  </span>
                </span>
                <span className="flex flex-col items-end gap-1.5">
                  <span className="label-mono text-muted">
                    {item.lastMessageAt ? formatStamp(item.lastMessageAt) : ""}
                  </span>
                  <UnreadBadge count={item.unread} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
