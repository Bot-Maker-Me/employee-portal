"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, RefreshCw, Send, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  dayKey,
  formatClock,
  formatDayLabel,
  formatDayStamp,
  formatFullStamp,
} from "@/lib/format";
import { sendPharmacyMessage } from "@/lib/pharma/actions";
import type { PharmaMessage, PharmaThread } from "@/lib/pharma/chat";
import { cn } from "@/lib/utils";

const MAX = 4000;
/** How often we ask for new messages while the tab is visible. */
const POLL_MS = 4000;

type ViewMessage = PharmaMessage & { pending?: boolean };

/** Merge by id (server rows win), oldest first. */
function mergeMessages(
  current: ViewMessage[],
  incoming: PharmaMessage[],
): ViewMessage[] {
  const byId = new Map<string, ViewMessage>();
  for (const message of current) byId.set(message.id, message);
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort(
    (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at),
  );
}

export function ThreadView({
  thread,
  messages: serverMessages,
  pharmacyName,
}: {
  thread: PharmaThread;
  messages: PharmaMessage[];
  pharmacyName: string;
}) {
  const [messages, setMessages] = useState<ViewMessage[]>(serverMessages);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closed = thread.status === "closed";

  const listRef = useRef<HTMLDivElement | null>(null);
  const atBottomRef = useRef(true);
  const messagesRef = useRef<ViewMessage[]>(serverMessages);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Fold in a fresh server render (navigation, back/forward) without dropping
  // anything the user just sent optimistically.
  useEffect(() => {
    setMessages((current) => mergeMessages(current, serverMessages));
  }, [serverMessages]);

  const scrollToBottom = useCallback(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, []);

  useEffect(() => {
    if (atBottomRef.current) scrollToBottom();
  }, [messages.length, scrollToBottom]);

  /** Fetches messages newer than the last confirmed one. */
  const poll = useCallback(async () => {
    const last = messagesRef.current.filter((message) => !message.pending).pop();
    const query = last?.created_at
      ? `?since=${encodeURIComponent(last.created_at)}`
      : "";
    try {
      const response = await fetch(
        `/api/pharmacy/threads/${thread.id}/messages${query}`,
        { cache: "no-store" },
      );
      if (!response.ok) return;
      const data = (await response.json()) as { messages?: PharmaMessage[] };
      if (data.messages?.length) {
        setMessages((current) => mergeMessages(current, data.messages ?? []));
      }
    } catch {
      // Offline or a transient failure: keep the current list and try again.
    }
  }, [thread.id]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") void poll();
    };
    const timer = window.setInterval(tick, POLL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [poll]);

  async function send() {
    const text = body.trim();
    if (!text || closed || sending) return;
    if (text.length > MAX) {
      setError(`Messages are limited to ${MAX} characters.`);
      return;
    }

    // Show it immediately, then reconcile with the stored row.
    const pendingId = `pending-${Date.now()}`;
    setMessages((current) => [
      ...current,
      {
        id: pendingId,
        thread_id: thread.id,
        sender_id: null,
        sender_side: "employee",
        body: text,
        created_at: new Date().toISOString(),
        read_at: null,
        pending: true,
      },
    ]);
    setBody("");
    setError(null);
    setSending(true);
    atBottomRef.current = true;

    const result = await sendPharmacyMessage(thread.id, text);
    setSending(false);

    if (result.error) {
      setMessages((current) => current.filter((m) => m.id !== pendingId));
      setBody(text);
      setError(
        result.error === "CLOSED"
          ? "This chat is closed."
          : result.error === "RATE_LIMITED"
            ? `Slow down — you can send up to 20 messages per minute${
                result.retryAfter ? ` (try again in ${result.retryAfter}s)` : ""
              }.`
            : result.detail
              ? `Message failed to send: ${result.detail}`
              : "Message failed to send. Please try again.",
      );
      return;
    }

    if (result.message) {
      const stored = result.message;
      setMessages((current) =>
        mergeMessages(
          current.filter((m) => m.id !== pendingId),
          [stored],
        ),
      );
    } else {
      setMessages((current) => current.filter((m) => m.id !== pendingId));
      void poll();
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  }

  function onScroll() {
    const list = listRef.current;
    if (!list) return;
    atBottomRef.current =
      list.scrollHeight - list.scrollTop - list.clientHeight < 120;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-start gap-4 border-b border-line p-5 md:p-8">
        <Link
          href="/pharmacy"
          className="mt-1 text-muted transition-colors hover:text-ink"
          aria-label="Back to chats"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-reveal truncate font-serif text-2xl text-ink">
            {thread.topic ?? "(no subject)"}
          </h1>
          <p className="label-mono mt-1 text-muted" suppressHydrationWarning>
            {pharmacyName} · started {formatDayStamp(thread.created_at)}
            {thread.status === "closed" ? " · closed" : " · live"}
          </p>
        </div>
        <Button variant="secondary" onClick={() => void poll()}>
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
        ref={listRef}
        onScroll={onScroll}
        className="scroll-slim flex-1 space-y-4 overflow-y-auto px-5 py-6 md:px-8"
        aria-live="polite"
      >
        {messages.map((message, index) => {
          const mine = message.sender_side === "employee";
          const previous = messages[index - 1];
          const startsDay =
            !previous ||
            dayKey(previous.created_at) !== dayKey(message.created_at);
          return (
            <Fragment key={message.id}>
              {startsDay && (
                <div className="flex animate-fade-in items-center gap-3 pt-1">
                  <span className="h-px flex-1 bg-line" aria-hidden="true" />
                  <span
                    className="label-mono text-muted"
                    suppressHydrationWarning
                  >
                    {formatDayLabel(message.created_at)}
                  </span>
                  <span className="h-px flex-1 bg-line" aria-hidden="true" />
                </div>
              )}
              <div
                className={cn("flex flex-col", mine ? "items-end" : "items-start")}
              >
                <div
                  className={cn(
                    "stagger max-w-[85%] rounded-ledger px-4 py-3 transition-[opacity,box-shadow] duration-300",
                    mine
                      ? "animate-rise-right bg-accent-tint text-ink ring-1 ring-inset ring-accent/30"
                      : "animate-rise-left bg-paper text-paper-ink shadow-ledger",
                    message.pending && "opacity-60",
                  )}
                  style={{ "--i": Math.min(index, 8) } as CSSProperties}
                >
                  <p
                    className={cn(
                      "label-mono mb-1.5",
                      mine ? "text-accent-soft" : "text-paper-ink/50",
                    )}
                  >
                    {mine ? "You" : "Pharmacy"} · {formatClock(message.created_at)}
                    {message.pending ? " · sending" : ""}
                  </p>
                  <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
                    {message.body}
                  </p>
                </div>
                <span
                  className="label-mono mt-1 text-muted"
                  suppressHydrationWarning
                >
                  {formatFullStamp(message.created_at)}
                </span>
              </div>
            </Fragment>
          );
        })}
      </div>

      <div className="border-t border-line p-5 md:p-8">
        {error && (
          <p role="alert" className="mb-3 text-[13px] text-accent-soft">
            {error}
          </p>
        )}
        <div className="rounded-ledger border border-line bg-sunken p-3 transition-colors duration-200 focus-within:border-accent/60">
          <textarea
            rows={3}
            value={body}
            disabled={closed}
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
            <Button onClick={() => void send()} disabled={closed || !body.trim()}>
              {sending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
