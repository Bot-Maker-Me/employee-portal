import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { listChannelSummaries } from "@/lib/channels";
import type { FeatureFlags } from "@/lib/features";

export type ActivitySummary = {
  openTopics: number;
  unreadTopics: number;
  unreadChannels: number;
};

type TopicUnread = { thread_id: string; unread_count: number };
type ChannelUnread = { channel_id: string; unread_count: number };

/**
 * Unread counters, memoised per request (React `cache`).
 *
 * The portal layout (nav badges) and the home page (recent activity) both need
 * these, so a single render must not run the same RPC twice.
 */
const topicUnreadRows = cache(async (): Promise<TopicUnread[]> => {
  const { data } = await createClient().rpc("topic_unread_counts");
  return (data ?? []) as TopicUnread[];
});

const channelUnreadRows = cache(async (): Promise<ChannelUnread[]> => {
  const { data } = await createClient().rpc("channel_unread_counts");
  return (data ?? []) as ChannelUnread[];
});

function sumUnread(rows: { unread_count: number }[]): number {
  return rows.reduce((sum, row) => sum + row.unread_count, 0);
}

/** Pharmacy half of the badge counts. Queries run in parallel. */
async function pharmacySummary(
  flags: FeatureFlags,
): Promise<{ openTopics: number; unreadTopics: number }> {
  if (!flags.employee_pharmacy_topics) {
    return { openTopics: 0, unreadTopics: 0 };
  }

  const supabase = createClient();
  const [{ count }, unread] = await Promise.all([
    supabase
      .from("topic_threads")
      .select("id", { count: "exact", head: true })
      .eq("status", "open"),
    topicUnreadRows(),
  ]);

  return { openTopics: count ?? 0, unreadTopics: sumUnread(unread) };
}

async function unreadChannelTotal(): Promise<number> {
  return sumUnread(await channelUnreadRows());
}

/**
 * Counts for the ticker and the nav badges. The pharmacy and team branches run
 * concurrently instead of one after the other.
 */
export async function getActivitySummary(
  flags: FeatureFlags,
): Promise<ActivitySummary> {
  const [pharmacy, unreadChannels] = await Promise.all([
    pharmacySummary(flags),
    flags.employee_team_chat ? unreadChannelTotal() : Promise.resolve(0),
  ]);

  return { ...pharmacy, unreadChannels };
}

export type ActivityItem = {
  id: string;
  kind: "topic" | "channel";
  title: string;
  href: string;
  at: string;
  unread: number;
};

async function recentTopics(flags: FeatureFlags): Promise<ActivityItem[]> {
  if (!flags.employee_pharmacy_topics) return [];

  const supabase = createClient();
  const [{ data: threads }, unread] = await Promise.all([
    supabase
      .from("topic_threads")
      .select("id, title, last_message_at")
      .order("last_message_at", { ascending: false })
      .limit(6),
    topicUnreadRows(),
  ]);

  const unreadMap: Record<string, number> = {};
  for (const row of unread) unreadMap[row.thread_id] = row.unread_count;

  return (threads ?? []).map((thread) => ({
    id: `topic-${thread.id}`,
    kind: "topic" as const,
    title: thread.title,
    href: `/pharmacy/${thread.id}`,
    at: thread.last_message_at,
    unread: unreadMap[thread.id] ?? 0,
  }));
}

async function recentChannels(currentUserId: string): Promise<ActivityItem[]> {
  const summaries = await listChannelSummaries(currentUserId);
  return summaries.slice(0, 6).map((summary) => ({
    id: `channel-${summary.channel.id}`,
    kind: "channel" as const,
    title: summary.label,
    href: `/team/${summary.channel.id}`,
    at: summary.lastMessageAt ?? summary.channel.created_at,
    unread: summary.unread,
  }));
}

export async function getRecentActivity(
  flags: FeatureFlags,
  currentUserId: string,
): Promise<ActivityItem[]> {
  const [topics, channels] = await Promise.all([
    recentTopics(flags),
    flags.employee_team_chat ? recentChannels(currentUserId) : Promise.resolve([]),
  ]);

  const items = [...topics, ...channels];
  items.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return items.slice(0, 8);
}
