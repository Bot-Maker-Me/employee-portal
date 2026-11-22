"use client";

import { useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { BellRing, CalendarClock, Loader2, Pencil, Pin, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteNotice, saveNotice } from "@/lib/sites/actions";
import type { Notice } from "@/lib/sites/data";
import { formatFullStamp } from "@/lib/format";
import { cn } from "@/lib/utils";

const TEXTAREA =
  "w-full rounded-btn border border-line bg-sunken px-3.5 py-2.5 text-[15px] text-ink placeholder:text-muted/60 transition-colors focus:border-accent focus:outline-none";

const PRIORITY_LABEL = { normal: "Notice", important: "Important", urgent: "Urgent" } as const;

function formatDate(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function NoticeForm({
  pharmacyId,
  initial,
  onClose,
}: {
  pharmacyId: string;
  initial: Notice | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [priority, setPriority] = useState<Notice["priority"]>(initial?.priority ?? "normal");
  const [pinned, setPinned] = useState(initial?.pinned ?? false);
  const [remindOn, setRemindOn] = useState(initial?.remind_on ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await saveNotice({
        id: initial?.id ?? null,
        pharmacyId,
        title,
        body,
        priority,
        pinned,
        remindOn: remindOn || null,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="animate-rise-sm space-y-4 rounded-ledger border border-accent-ring bg-raised p-5"
    >
      <p className="font-serif text-lg text-ink">{initial ? "Edit notice" : "Post a notice or reminder"}</p>
      <div className="space-y-1.5">
        <Label htmlFor="n-title">Title</Label>
        <Input id="n-title" value={title} maxLength={160} required onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="n-body">Details</Label>
        <textarea
          id="n-body"
          rows={5}
          maxLength={8000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className={TEXTAREA}
        />
      </div>
      <div className="flex flex-wrap items-end gap-5">
        <div className="space-y-1.5">
          <Label htmlFor="n-priority">Priority</Label>
          <select
            id="n-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as Notice["priority"])}
            className="rounded-btn border border-line bg-sunken px-3 py-2.5 text-[14px] text-ink focus:border-accent focus:outline-none"
          >
            <option value="normal">Normal</option>
            <option value="important">Important</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="n-remind">Reminder date (optional)</Label>
          <Input
            id="n-remind"
            type="date"
            value={remindOn}
            onChange={(e) => setRemindOn(e.target.value)}
            className="w-auto"
          />
        </div>
        <label className="inline-flex items-center gap-2 pb-2.5 text-[14px] text-ink">
          <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
          Pin to top
        </label>
      </div>
      {error && <p className="text-[13px] text-warn">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
          {initial ? "Save" : "Post"}
        </Button>
        <Button variant="ghost" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function NoticeBoard({
  pharmacyId,
  notices,
  canEdit,
}: {
  pharmacyId: string;
  notices: Notice[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Notice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const today = new Date().toISOString().slice(0, 10);

  function remove(notice: Notice) {
    if (!window.confirm(`Delete “${notice.title}”?`)) return;
    startTransition(async () => {
      const result = await deleteNotice({ id: notice.id });
      if (!result.ok) setError(result.message);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {canEdit && !adding && !editing && (
        <Button onClick={() => setAdding(true)}>
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          New notice
        </Button>
      )}
      {canEdit && adding && <NoticeForm pharmacyId={pharmacyId} initial={null} onClose={() => setAdding(false)} />}
      {canEdit && editing && (
        <NoticeForm key={editing.id} pharmacyId={pharmacyId} initial={editing} onClose={() => setEditing(null)} />
      )}
      {error && <p className="text-[13px] text-warn">{error}</p>}

      {notices.length === 0 ? (
        <div className="rounded-ledger border border-line bg-raised p-8 text-center">
          <p className="text-[15px] text-ink">No notices or reminders.</p>
          <p className="mt-1.5 text-[14px] text-muted">
            {canEdit ? "Post one to let staff know." : "You’re all caught up."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {notices.map((notice, index) => {
            const due = notice.remind_on && notice.remind_on <= today;
            return (
              <li
                key={notice.id}
                className={cn(
                  "animate-rise stagger rounded-ledger border bg-raised p-5",
                  notice.priority === "urgent" ? "border-accent" : "border-line",
                )}
                style={{ "--i": index } as CSSProperties}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-btn",
                      notice.priority === "normal" ? "bg-sunken text-muted" : "bg-accent-tint text-accent-soft",
                    )}
                  >
                    <BellRing className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {notice.pinned && (
                        <span className="label-mono inline-flex items-center gap-1 text-accent-soft">
                          <Pin className="h-3 w-3" aria-hidden="true" /> Pinned
                        </span>
                      )}
                      {notice.priority !== "normal" && (
                        <span className="label-mono rounded-btn border border-accent bg-accent-tint px-2 py-0.5 text-accent-soft">
                          {PRIORITY_LABEL[notice.priority]}
                        </span>
                      )}
                      {notice.remind_on && (
                        <span
                          className={cn(
                            "label-mono inline-flex items-center gap-1",
                            due ? "text-warn" : "text-muted",
                          )}
                        >
                          <CalendarClock className="h-3 w-3" aria-hidden="true" />
                          {due ? "Due " : "Reminder "}
                          {formatDate(notice.remind_on)}
                        </span>
                      )}
                    </div>
                    <h3 className="mt-1.5 font-serif text-xl text-ink">{notice.title}</h3>
                    {notice.body && (
                      <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-muted">{notice.body}</p>
                    )}
                    <p className="label-mono mt-3 text-muted/70">Posted {formatFullStamp(notice.created_at)}</p>
                  </div>
                  {canEdit && (
                    <div className="flex shrink-0 gap-1">
                      <button
                        onClick={() => {
                          setAdding(false);
                          setEditing(notice);
                        }}
                        className="rounded-btn p-1.5 text-muted hover:bg-sunken hover:text-ink"
                        aria-label="Edit notice"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => remove(notice)}
                        className="rounded-btn p-1.5 text-muted hover:bg-sunken hover:text-accent-soft"
                        aria-label="Delete notice"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
