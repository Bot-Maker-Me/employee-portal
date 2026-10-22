"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Pencil, Send, ShieldAlert, Trash2, UserPlus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatFullStamp, formatClock } from "@/lib/format";
import type { DirectoryEntry, EmployeeChannel, EmployeeMessage } from "@/lib/channels";
import { cn } from "@/lib/utils";

const MAX = 4000;

type Member = { id: string; name: string };

export function ChannelView({
  channel,
  label,
  members,
  messages: initialMessages,
  currentUserId,
  directory,
}: {
  channel: EmployeeChannel;
  label: string;
  members: Member[];
  messages: EmployeeMessage[];
  currentUserId: string;
  directory: DirectoryEntry[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<EmployeeMessage[]>(initialMessages);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [manageOpen, setManageOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(channel.name ?? "");
  const [addId, setAddId] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const isCreator = channel.created_by === currentUserId;
  const isGroup = channel.type === "group";

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const member of members) map.set(member.id, member.name);
    for (const entry of directory) if (!map.has(entry.id)) map.set(entry.id, entry.full_name);
    return map;
  }, [members, directory]);

  const addableColleagues = useMemo(() => {
    const existing = new Set(members.map((m) => m.id));
    return directory.filter(
      (person) => person.id !== currentUserId && !existing.has(person.id),
    );
  }, [directory, members, currentUserId]);

  // Mark read on open.
  useEffect(() => {
    const supabase = createClient();
    void supabase
      .from("employee_channel_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("channel_id", channel.id)
      .eq("user_id", currentUserId);
  }, [channel.id, currentUserId]);

  // Realtime: inserts + edits/deletes.
  useEffect(() => {
    const supabase = createClient();
    const channelRef = supabase
      .channel(`employee-${channel.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "employee_messages",
          filter: `channel_id=eq.${channel.id}`,
        },
        (payload) => {
          const row = payload.new as EmployeeMessage;
          setMessages((prev) =>
            prev.some((m) => m.id === row.id) ? prev : [...prev, row],
          );
          if (row.sender_id !== currentUserId) {
            void supabase
              .from("employee_channel_members")
              .update({ last_read_at: new Date().toISOString() })
              .eq("channel_id", channel.id)
              .eq("user_id", currentUserId);
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "employee_messages",
          filter: `channel_id=eq.${channel.id}`,
        },
        (payload) => {
          const row = payload.new as EmployeeMessage;
          setMessages((prev) => prev.map((m) => (m.id === row.id ? row : m)));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channelRef);
    };
  }, [channel.id, currentUserId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function send() {
    const text = body.trim();
    if (!text) return;
    if (text.length > MAX) {
      setError(`Messages are limited to ${MAX} characters.`);
      return;
    }

    setSending(true);
    setError(null);
    const supabase = createClient();
    const { data, error: sendError } = await supabase
      .from("employee_messages")
      .insert({ channel_id: channel.id, sender_id: currentUserId, body: text })
      .select()
      .single();

    setSending(false);
    if (sendError || !data) {
      setError(
        sendError?.message.includes("RATE_LIMIT")
          ? "Slow down — you can send up to 20 messages per minute."
          : "Message failed to send. Please try again.",
      );
      return;
    }
    setBody("");
    setMessages((prev) =>
      prev.some((m) => m.id === data.id) ? prev : [...prev, data as EmployeeMessage],
    );
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  }

  async function saveEdit(id: string) {
    const text = editBody.trim();
    if (!text) return;
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("employee_messages")
      .update({ body: text })
      .eq("id", id);
    if (updateError) {
      setError("Could not save your edit.");
      return;
    }
    setEditingId(null);
    setEditBody("");
  }

  async function softDelete(id: string) {
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("employee_messages")
      .update({ body: "", deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (deleteError) setError("Could not delete the message.");
  }

  async function rename() {
    const next = renameValue.trim();
    if (!next) return;
    const supabase = createClient();
    await supabase.from("employee_channels").update({ name: next }).eq("id", channel.id);
    router.refresh();
  }

  async function addMember() {
    if (!addId) return;
    const supabase = createClient();
    await supabase.rpc("add_channel_members", {
      p_channel_id: channel.id,
      p_member_ids: [addId],
    });
    setAddId("");
    router.refresh();
  }

  async function removeMember(userId: string) {
    const supabase = createClient();
    await supabase.rpc("remove_channel_member", {
      p_channel_id: channel.id,
      p_user_id: userId,
    });
    router.refresh();
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start gap-4 border-b border-line p-5 md:p-8">
        <Link
          href="/team"
          className="mt-1 text-muted transition-colors hover:text-ink"
          aria-label="Back to chats"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-serif text-2xl text-ink">{label}</h1>
          <p className="label-mono mt-1 text-muted">
            {isGroup ? `Group · ${members.length} members` : "Direct message"}
          </p>
        </div>
        {isGroup && isCreator && (
          <Button variant="secondary" onClick={() => setManageOpen((v) => !v)}>
            {manageOpen ? "Close" : "Manage"}
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2 border-b border-line bg-accent-tint px-5 py-2.5 md:px-8">
        <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-accent-soft" aria-hidden="true" />
        <span className="label-mono text-accent-soft">
          Internal messages. Use resident IDs or initials, never full names.
        </span>
      </div>

      {manageOpen && isGroup && isCreator && (
        <div className="space-y-5 border-b border-line bg-raised p-5 md:px-8">
          <div className="space-y-2">
            <p className="label-mono text-muted">Rename group</p>
            <div className="flex gap-2">
              <Input
                value={renameValue}
                maxLength={80}
                onChange={(event) => setRenameValue(event.target.value)}
                aria-label="Group name"
              />
              <Button onClick={rename}>Save</Button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="label-mono text-muted">Members</p>
            <ul className="flex flex-wrap gap-2">
              {members.map((member) => (
                <li
                  key={member.id}
                  className="label-mono inline-flex items-center gap-2 rounded-btn border border-line px-2.5 py-1.5 text-muted"
                >
                  {member.name}
                  {member.id !== channel.created_by && (
                    <button
                      type="button"
                      onClick={() => removeMember(member.id)}
                      aria-label={`Remove ${member.name}`}
                      className="text-muted transition-colors hover:text-accent-soft"
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {addableColleagues.length > 0 && (
            <div className="space-y-2">
              <p className="label-mono text-muted">Add a colleague</p>
              <div className="flex gap-2">
                <select
                  value={addId}
                  onChange={(event) => setAddId(event.target.value)}
                  aria-label="Add member"
                  className="flex-1 rounded-btn border border-line bg-sunken px-3 py-2.5 text-[15px] text-ink focus:border-accent focus:outline-none"
                >
                  <option value="">Select a colleague…</option>
                  {addableColleagues.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.full_name}
                    </option>
                  ))}
                </select>
                <Button onClick={addMember} disabled={!addId}>
                  <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                  Add
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-6 md:px-8" aria-live="polite">
        {messages.map((message) => {
          const mine = message.sender_id === currentUserId;
          const deleted = Boolean(message.deleted_at);
          const isEditing = editingId === message.id;

          return (
            <div key={message.id} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-ledger px-4 py-3",
                  mine
                    ? "bg-accent-tint text-ink ring-1 ring-inset ring-accent/30"
                    : "border border-line bg-raised text-ink",
                )}
              >
                <p className="label-mono mb-1.5 text-muted">
                  {mine ? "You" : nameById.get(message.sender_id) ?? "Colleague"} ·{" "}
                  {formatClock(message.created_at)}
                </p>

                {deleted ? (
                  <p className="text-[14px] italic text-muted">message deleted</p>
                ) : isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      rows={3}
                      value={editBody}
                      maxLength={MAX}
                      onChange={(event) => setEditBody(event.target.value)}
                      className="w-full resize-none rounded-btn border border-line bg-sunken px-3 py-2 text-[15px] text-ink focus:border-accent focus:outline-none"
                      aria-label="Edit message"
                    />
                    <div className="flex gap-2">
                      <Button onClick={() => saveEdit(message.id)}>Save</Button>
                      <Button variant="secondary" onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
                    {message.body}
                  </p>
                )}
              </div>

              <div className="mt-1 flex items-center gap-3">
                <span className="label-mono text-muted">
                  {formatFullStamp(message.created_at)}
                  {message.edited_at && !deleted ? " · edited" : ""}
                </span>
                {mine && !deleted && !isEditing && (
                  <span className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(message.id);
                        setEditBody(message.body);
                      }}
                      aria-label="Edit message"
                      className="text-muted transition-colors hover:text-ink"
                    >
                      <Pencil className="h-3 w-3" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => softDelete(message.id)}
                      aria-label="Delete message"
                      className="text-muted transition-colors hover:text-accent-soft"
                    >
                      <Trash2 className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </span>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-line p-5 md:p-8">
        {error && (
          <p role="alert" className="mb-3 text-[13px] text-accent-soft">
            {error}
          </p>
        )}
        <div className="rounded-ledger border border-line bg-sunken p-3">
          <textarea
            rows={3}
            value={body}
            disabled={sending}
            maxLength={MAX}
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Write a message…  Enter to send, Shift+Enter for a new line"
            aria-label="Message"
            className="w-full resize-none bg-transparent text-[15px] text-ink placeholder:text-muted/60 focus:outline-none disabled:cursor-not-allowed"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="label-mono text-muted">
              {body.length} / {MAX}
            </span>
            <Button onClick={() => void send()} disabled={sending || !body.trim()}>
              {sending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {sending ? "Sending" : "Send"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
