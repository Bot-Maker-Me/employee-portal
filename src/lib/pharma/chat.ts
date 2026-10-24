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
