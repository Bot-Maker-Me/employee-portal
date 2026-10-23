import { createClient } from "@/lib/supabase/server";
import type { TopicCategory, TopicMessage, TopicStatus, TopicThread } from "@/lib/topics";

export type ListParams = {
  status: TopicStatus | "all";
  category: TopicCategory | "all";
  unreadOnly: boolean;
  search?: string;
};

/** Threads for the caller's organization, urgent first, + unread counts. */
export async function listThreads(params: ListParams) {
  const supabase = createClient();

  let query = supabase
    .from("topic_threads")
    .select("*")
    .order("priority", { ascending: false }) // 'urgent' sorts before 'normal'
    .order("last_message_at", { ascending: false });

  if (params.status !== "all") query = query.eq("status", params.status);
  if (params.category !== "all") query = query.eq("category", params.category);
  if (params.search?.trim())
    query = query.ilike("title", `%${params.search.trim()}%`);

  const [{ data: threads }, { data: unreadRows }] = await Promise.all([
    query,
    supabase.rpc("topic_unread_counts"),
  ]);

  const unread: Record<string, number> = {};
  for (const row of unreadRows ?? []) {
    unread[row.thread_id] = row.unread_count;
  }

  let list = (threads ?? []) as TopicThread[];
  if (params.unreadOnly) list = list.filter((t) => (unread[t.id] ?? 0) > 0);

  return { threads: list, unread };
}

/** A single thread + its messages (RLS restricts to the caller's org). */
export async function getThread(id: string) {
  const supabase = createClient();

  const { data: thread } = await supabase
    .from("topic_threads")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!thread) return null;

  const { data: messages } = await supabase
    .from("topic_messages")
    .select("*")
    .eq("thread_id", id)
    .order("created_at", { ascending: true });

  return {
    thread: thread as TopicThread,
    messages: (messages ?? []) as TopicMessage[],
  };
}
