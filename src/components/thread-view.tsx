"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Lock, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { CategoryTag, PriorityTag, StatusTag } from "@/components/topic-badges";
import { formatFullStamp, formatClock } from "@/lib/format";
import type { TopicMessage, TopicThread } from "@/lib/topics";
import { cn } from "@/lib/utils";

const MAX = 4000;

export function ThreadView({
  thread: initialThread,
  messages: initialMessages,
  currentUserId,
}: {
  thread: TopicThread;
  messages: TopicMessage[];
  currentUserId: string;
}) {
  const [thread, setThread] = useState(initialThread);
  const [messages, setMessages] = useState<TopicMessage[]>(initialMessages);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const closed = thread.status === "closed";

  // Mark the thread read when opened.
  useEffect(() => {
    const supabase = createClient();
    void supabase
      .from("topic_threads")
      .update({ employee_last_read_at: new Date().toISOString() })
      .eq("id", thread.id);
  }, [thread.id]);

  // Realtime: new messages on this thread.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`topic-${thread.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "topic_messages",
          filter: `thread_id=eq.${thread.id}`,
        },
        (payload) => {
          const row = payload.new as TopicMessage;
          setMessages((prev) =>
            prev.some((m) => m.id === row.id) ? prev : [...prev, row],
          );
          void supabase
            .from("topic_threads")
            .update({ employee_last_read_at: new Date().toISOString() })
            .eq("id", thread.id);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [thread.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function send() {
    const text = body.trim();
    if (!text || closed) return;
    if (text.length > MAX) {
      setError(`Messages are limited to ${MAX} characters.`);
      return;
    }

    setSending(true);
    setError(null);
    const supabase = createClient();
    const { data, error: sendError } = await supabase
      .from("topic_messages")
      .insert({
        thread_id: thread.id,
        sender_id: currentUserId,
        sender_side: "employee",
        body: text,
      })
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
      prev.some((m) => m.id === data.id) ? prev : [...prev, data as TopicMessage],
    );
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  }

  const pharmacyLastRead = thread.pharmacy_last_read_at
    ? new Date(thread.pharmacy_last_read_at).getTime()
    : 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start gap-4 border-b border-line p-5 md:p-8">
        <Link
          href="/pharmacy"
          className="mt-1 text-muted transition-colors hover:text-ink"
          aria-label="Back to chats"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <CategoryTag category={thread.category} />
            <PriorityTag priority={thread.priority} />
            <StatusTag status={thread.status} />
          </div>
          <h1 className="mt-3 font-serif text-2xl leading-tight text-ink">
            {thread.title}
          </h1>
        </div>
      </div>

      {closed && (
        <div className="flex items-center gap-2 border-b border-line bg-accent-tint px-5 py-3 md:px-8">
          <Lock className="h-4 w-4 text-accent-soft" aria-hidden="true" />
          <span className="label-mono text-accent-soft">
            Thread closed · replies disabled
          </span>
        </div>
      )}

      <div
        className="flex-1 space-y-4 overflow-y-auto px-5 py-6 md:px-8"
        aria-live="polite"
      >
        {messages.map((message) => {
          const mine = message.sender_side === "employee";
          const read = mine && pharmacyLastRead >= new Date(message.created_at).getTime();
          return (
            <div
              key={message.id}
              className={cn("flex flex-col", mine ? "items-end" : "items-start")}
            >
              <div
                className={cn(
                  "max-w-[85%] animate-rise rounded-ledger px-4 py-3",
                  mine
                    ? "bg-accent-tint text-ink ring-1 ring-inset ring-accent/30"
                    : "bg-paper text-paper-ink shadow-ledger",
                )}
              >
                <p
                  className={cn(
                    "label-mono mb-1.5",
                    mine ? "text-accent-soft" : "text-paper-ink/50",
                  )}
                >
                  {mine ? "You" : "Pharmacy"} · {formatClock(message.created_at)}
                </p>
                <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
                  {message.body}
                </p>
              </div>
              <span className="label-mono mt-1 text-muted">
                {mine ? (read ? "Read" : "Delivered") : "Pharmacy"} ·{" "}
                {formatFullStamp(message.created_at)}
              </span>
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
            disabled={closed || sending}
            maxLength={MAX}
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={closed ? "This thread is closed." : "Write a message…  Enter to send, Shift+Enter for a new line"}
            aria-label="Message"
            className="w-full resize-none bg-transparent text-[15px] text-ink placeholder:text-muted/60 focus:outline-none disabled:cursor-not-allowed"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="label-mono text-muted">
              {body.length} / {MAX}
            </span>
            <Button onClick={() => void send()} disabled={closed || sending || !body.trim()}>
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
