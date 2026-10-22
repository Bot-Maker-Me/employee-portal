import { createClient } from "@/lib/supabase/server";
import { listChannelSummaries } from "@/lib/channels";
import type { FeatureFlags } from "@/lib/features";

export type ActivitySummary = {
  openTopics: number;
  unreadTopics: number;
  unreadChannels: number;
};

export async function getActivitySummary(
  flags: FeatureFlags,
): Promise<ActivitySummary> {
  const supabase = createClient();

  let openTopics = 0;
  let unreadTopics = 0;
  let unreadChannels = 0;

  if (flags.employee_pharmacy_topics) {
    const [{ count }, { data: topicUnread }] = await Promise.all([
      supabase
        .from("topic_threads")
        .select("id", { count: "exact", head: true })
        .eq("status", "open"),
      supabase.rpc("topic_unread_counts"),
    ]);
    openTopics = count ?? 0;
    unreadTopics = (topicUnread ?? []).reduce((sum, r) => sum + r.unread_count, 0);
  }

  if (flags.employee_team_chat) {
    const { data: channelUnread } = await supabase.rpc("channel_unread_counts");
    unreadChannels = (channelUnread ?? []).reduce(
      (sum, r) => sum + r.unread_count,
      0,
    );
  }

  return { openTopics, unreadTopics, unreadChannels };
}

export type ActivityItem = {
  id: string;
  kind: "topic" | "channel";
  title: string;
  href: string;
  at: string;
  unread: number;
};

export async function getRecentActivity(
  flags: FeatureFlags,
  currentUserId: string,
): Promise<ActivityItem[]> {
  const supabase = createClient();
  const items: ActivityItem[] = [];

  if (flags.employee_pharmacy_topics) {
    const [{ data: threads }, { data: unread }] = await Promise.all([
      supabase
        .from("topic_threads")
        .select("id, title, last_message_at")
        .order("last_message_at", { ascending: false })
        .limit(6),
      supabase.rpc("topic_unread_counts"),
    ]);
    const unreadMap: Record<string, number> = {};
    for (const row of unread ?? []) unreadMap[row.thread_id] = row.unread_count;
    for (const thread of threads ?? []) {
      items.push({
        id: `topic-${thread.id}`,
        kind: "topic",
        title: thread.title,
        href: `/pharmacy/${thread.id}`,
        at: thread.last_message_at,
        unread: unreadMap[thread.id] ?? 0,
      });
    }
  }

  if (flags.employee_team_chat) {
    const summaries = await listChannelSummaries(currentUserId);
    for (const summary of summaries.slice(0, 6)) {
      items.push({
        id: `channel-${summary.channel.id}`,
        kind: "channel",
        title: summary.label,
        href: `/team/${summary.channel.id}`,
        at: summary.lastMessageAt ?? summary.channel.created_at,
        unread: summary.unread,
      });
    }
  }

  items.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return items.slice(0, 8);
}
