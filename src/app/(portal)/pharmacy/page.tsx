import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile";
import { getFeatureFlags } from "@/lib/features";
import {
  CATEGORY_ORDER,
  type TopicCategory,
  type TopicStatus,
} from "@/lib/topics";
import { listThreads } from "@/lib/topics-server";
import { formatStamp } from "@/lib/format";
import { FeatureDisabled } from "@/components/feature-disabled";
import { SectionMarker } from "@/components/section-marker";
import { ThreadFilters } from "@/components/thread-filters";
import { CategoryTag, PriorityTag, UnreadBadge } from "@/components/topic-badges";

function parseStatus(value: string | undefined): TopicStatus | "all" {
  return value === "closed" || value === "all" ? value : "open";
}

function parseCategory(value: string | undefined): TopicCategory | "all" {
  return CATEGORY_ORDER.includes(value as TopicCategory)
    ? (value as TopicCategory)
    : "all";
}

export default async function PharmacyTopicsPage({
  searchParams,
}: {
  searchParams: {
    status?: string;
    category?: string;
    unread?: string;
    q?: string;
  };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(user.id);
  if (!profile?.organization) redirect("/home");

  const flags = await getFeatureFlags(profile.organization);
  if (!flags.employee_pharmacy_topics) {
    return <FeatureDisabled label="Pharmacy Chat" />;
  }

  const status = parseStatus(searchParams.status);
  const category = parseCategory(searchParams.category);
  const unreadOnly = searchParams.unread === "1";
  const search = (searchParams.q ?? "").trim();

  const { threads, unread } = await listThreads({
    status,
    category,
    unreadOnly,
    search,
  });

  const totalUnread = Object.values(unread).reduce((sum, n) => sum + n, 0);

  return (
    <div className="animate-rise space-y-6 p-5 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <SectionMarker index="03" label="Pharmacy" />
          <h1 className="mt-4 font-serif text-3xl text-ink">Pharmacy Chat</h1>
          <p className="mt-1.5 text-[14px] text-muted">
            {totalUnread > 0
              ? `${totalUnread} unread ${totalUnread === 1 ? "reply" : "replies"}`
              : "All caught up"}
          </p>
        </div>
        <Link
          href="/pharmacy/new"
          className="label-mono inline-flex items-center gap-2 rounded-btn bg-accent px-4 py-2.5 text-white transition-colors hover:bg-accent-hover"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          New chat
        </Link>
      </div>

      <ThreadFilters
        status={status}
        category={category}
        unread={unreadOnly}
        search={search}
      />

      {threads.length === 0 ? (
        <div className="rounded-ledger border border-line bg-raised p-8 text-center">
          <p className="text-[15px] text-ink">No chats here yet.</p>
          <p className="mt-1.5 text-[14px] text-muted">
            Start a chat to ask the pharmacy a question.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-ledger border border-line bg-raised">
          {threads.map((thread) => (
            <li key={thread.id}>
              <Link
                href={`/pharmacy/${thread.id}`}
                className="flex items-start gap-4 px-5 py-4 transition-colors hover:bg-sunken"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <CategoryTag category={thread.category} />
                    <PriorityTag priority={thread.priority} />
                    {thread.status === "closed" && (
                      <span className="label-mono text-muted">Closed</span>
                    )}
                  </div>
                  <p className="mt-2 truncate font-serif text-lg text-ink">
                    {thread.title}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="label-mono text-muted">
                    {formatStamp(thread.last_message_at)}
                  </span>
                  <UnreadBadge count={unread[thread.id] ?? 0} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
