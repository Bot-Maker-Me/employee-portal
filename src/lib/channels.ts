import { createClient } from "@/lib/supabase/server";

export type ChannelType = "direct" | "group";

export type EmployeeChannel = {
  id: string;
  organization: string;
  type: ChannelType;
  name: string | null;
  created_by: string;
  created_at: string;
};

export type EmployeeMessage = {
  id: string;
  channel_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
};

export type DirectoryEntry = { id: string; full_name: string };

export type ChannelSummary = {
  channel: EmployeeChannel;
  label: string;
  memberCount: number;
  unread: number;
  lastMessageAt: string | null;
  lastPreview: string | null;
};

export async function getDirectory(): Promise<DirectoryEntry[]> {
  const supabase = createClient();
  const { data } = await supabase.rpc("org_directory");
  return (data ?? []) as DirectoryEntry[];
}

export async function listChannelSummaries(
  currentUserId: string,
): Promise<ChannelSummary[]> {
  const supabase = createClient();

  const { data: memberships } = await supabase
    .from("employee_channel_members")
    .select("channel_id")
    .eq("user_id", currentUserId);

  const ids = (memberships ?? []).map((m) => m.channel_id);
  if (ids.length === 0) return [];

  const [
    { data: channels },
    { data: members },
    { data: unreadRows },
    { data: recent },
    directory,
  ] = await Promise.all([
    supabase.from("employee_channels").select("*").in("id", ids),
    supabase
      .from("employee_channel_members")
      .select("channel_id, user_id")
      .in("channel_id", ids),
    supabase.rpc("channel_unread_counts"),
    supabase
      .from("employee_messages")
      .select("channel_id, body, created_at, deleted_at")
      .in("channel_id", ids)
      .order("created_at", { ascending: false })
      .limit(300),
    getDirectory(),
  ]);

  const nameById = new Map(directory.map((d) => [d.id, d.full_name]));

  const unread: Record<string, number> = {};
  for (const row of unreadRows ?? []) unread[row.channel_id] = row.unread_count;

  const membersByChannel = new Map<string, string[]>();
  for (const m of members ?? []) {
    const list = membersByChannel.get(m.channel_id) ?? [];
    list.push(m.user_id);
    membersByChannel.set(m.channel_id, list);
  }

  const lastByChannel = new Map<string, { body: string; created_at: string }>();
  for (const msg of recent ?? []) {
    if (msg.deleted_at) continue;
    if (!lastByChannel.has(msg.channel_id)) {
      lastByChannel.set(msg.channel_id, {
        body: msg.body,
        created_at: msg.created_at,
      });
    }
  }

  const summaries: ChannelSummary[] = (channels ?? []).map((channel) => {
    const memberIds = membersByChannel.get(channel.id) ?? [];
    const otherNames = memberIds
      .filter((id) => id !== currentUserId)
      .map((id) => nameById.get(id) ?? "Team member");
    const label =
      channel.type === "direct"
        ? otherNames[0] ?? "Direct chat"
        : channel.name ?? "Group chat";
    const last = lastByChannel.get(channel.id) ?? null;

    return {
      channel: channel as EmployeeChannel,
      label,
      memberCount: memberIds.length,
      unread: unread[channel.id] ?? 0,
      lastMessageAt: last?.created_at ?? null,
      lastPreview: last?.body ?? null,
    };
  });

  summaries.sort((a, b) => {
    const at = a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0;
    const bt = b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0;
    if (at !== bt) return bt - at;
    return a.label.localeCompare(b.label);
  });

  return summaries;
}

export async function getChannel(id: string, currentUserId: string) {
  const supabase = createClient();

  const { data: channel } = await supabase
    .from("employee_channels")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!channel) return null;

  const [{ data: members }, { data: messages }, directory] = await Promise.all([
    supabase
      .from("employee_channel_members")
      .select("user_id")
      .eq("channel_id", id),
    supabase
      .from("employee_messages")
      .select("*")
      .eq("channel_id", id)
      .order("created_at", { ascending: true }),
    getDirectory(),
  ]);

  const nameById = new Map(directory.map((d) => [d.id, d.full_name]));
  const memberIds = (members ?? []).map((m) => m.user_id);
  const otherNames = memberIds
    .filter((mid) => mid !== currentUserId)
    .map((mid) => nameById.get(mid) ?? "Team member");

  const label =
    channel.type === "direct"
      ? otherNames[0] ?? "Direct chat"
      : channel.name ?? "Group chat";

  return {
    channel: channel as EmployeeChannel,
    label,
    members: memberIds.map((mid) => ({
      id: mid,
      name: nameById.get(mid) ?? "Team member",
    })),
    messages: (messages ?? []) as EmployeeMessage[],
    currentUserId,
  };
}
