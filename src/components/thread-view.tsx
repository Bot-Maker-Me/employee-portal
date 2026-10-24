"use client";

import { useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, RefreshCw, Send, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatClock, formatFullStamp } from "@/lib/format";
import { sendPharmacyMessage } from "@/lib/pharma/actions";
import type { PharmaMessage, PharmaThread } from "@/lib/pharma/chat";
import { cn } from "@/lib/utils";

const MAX = 4000;

export function ThreadView({
  thread,
  messages,
  pharmacyName,
}: {
  thread: PharmaThread;
  messages: PharmaMessage[];
  pharmacyName: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closed = thread.status === "closed";

  async function send() {
    const text = body.trim();
    if (!text) return;
    if (text.length > MAX) {
      setError(`Messages are limited to ${MAX} characters.`);
      return;
    }

    setSending(true);
    setError(null);
    const result = await sendPharmacyMessage(thread.id, text);
    setSending(false);

    if (result.error) {
      setError(
        result.error === "CLOSED"
          ? "This chat is closed."
          : "Message failed to send. Please try again.",
      );
      return;
    }
    setBody("");
    router.refresh();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  }

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
          <h1 className="truncate font-serif text-2xl text-ink">
            {thread.topic ?? "(no subject)"}
          </h1>
          <p className="label-mono mt-1 text-muted">
            {pharmacyName}
            {thread.status === "closed" ? " · closed" : ""}
          </p>
        </div>
        <Button variant="secondary" onClick={() => router.refresh()}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Refresh
        </Button>
      </div>

      <div className="flex items-center gap-2 border-b border-line bg-accent-tint px-5 py-2.5 md:px-8">
        <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-accent-soft" aria-hidden="true" />
        <span className="label-mono text-accent-soft">
          Shared chat with the pharmacy. Never include patient names.
        </span>
      </div>

      <div
        className="flex-1 space-y-4 overflow-y-auto px-5 py-6 md:px-8"
        aria-live="polite"
      >
        {messages.map((message) => {
          const mine = message.sender_side === "employee";
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
                {formatFullStamp(message.created_at)}
              </span>
            </div>
          );
        })}
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
            placeholder={
              closed
                ? "This chat is closed."
                : "Write a message…  Enter to send, Shift+Enter for a new line"
            }
            aria-label="Message"
            className="w-full resize-none bg-transparent text-[15px] text-ink placeholder:text-muted/60 focus:outline-none disabled:cursor-not-allowed"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="label-mono text-muted">
              {body.length} / {MAX}
            </span>
            <Button
              onClick={() => void send()}
              disabled={closed || sending || !body.trim()}
            >
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
