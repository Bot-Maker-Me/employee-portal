import { createPharmaClient } from "@/lib/pharma/client";

export type PharmaThread = {
  id: string;
  organization_id: string | null;
  organization_name: string | null;
  pharmacy_id: string;
  created_by: string | null;
  topic: string | null;
  category: string | null;
  priority: string | null;
  status: string | null;
  created_at: string;
  closed_at: string | null;
  assigned_user_id: string | null;
};

export type PharmaMessage = {
  id: string;
  thread_id: string;
  sender_id: string | null;
  sender_side: string | null;
  body: string;
  created_at: string;
  read_at: string | null;
};

/** The caller's organization's threads, newest first. */
export async function listThreads(
  organizationName: string,
): Promise<PharmaThread[]> {
  const supabase = createPharmaClient();
  const { data, error } = await supabase
    .from("topic_threads")
    .select("*")
    .eq("organization_name", organizationName)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as PharmaThread[];
}

/** The organization a thread belongs to, for authorization checks. */
export async function getThreadOrganization(
  threadId: string,
): Promise<string | null> {
  const supabase = createPharmaClient();
  const { data } = await supabase
    .from("topic_threads")
    .select("organization_name")
    .eq("id", threadId)
    .maybeSingle();
  return (data?.organization_name as string | null) ?? null;
}

/**
 * The newest messages on a thread, oldest first. When `since` is given, only
 * messages from that timestamp onwards are returned (inclusive — the client
 * de-duplicates by id) so polling stays cheap.
 */
export async function listThreadMessages(
  threadId: string,
  since?: string | null,
): Promise<PharmaMessage[]> {
  const supabase = createPharmaClient();
  let query = supabase
    .from("topic_messages")
    .select("id, thread_id, sender_id, sender_side, body, created_at, read_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (since) query = query.gte("created_at", since);

  const { data, error } = await query;
  if (error) return [];
  return ((data ?? []) as PharmaMessage[]).reverse();
}

export async function getThread(id: string): Promise<{
  thread: PharmaThread;
  messages: PharmaMessage[];
} | null> {
  const supabase = createPharmaClient();

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
    thread: thread as PharmaThread,
    messages: (messages ?? []) as PharmaMessage[],
  };
}
