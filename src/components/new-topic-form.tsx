"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CATEGORY_LABELS, CATEGORY_ORDER, type TopicCategory } from "@/lib/topics";
import { cn } from "@/lib/utils";

const MAX = 4000;

export function NewTopicForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<TopicCategory>("general");
  const [priority, setPriority] = useState<"normal" | "urgent">("normal");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!title.trim()) return setError("Please add a chat title.");
    if (!body.trim()) return setError("Please write your first message.");
    if (body.length > MAX) return setError(`Messages are limited to ${MAX} characters.`);

    setLoading(true);
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("create_topic_thread", {
      p_title: title.trim(),
      p_category: category,
      p_priority: priority,
      p_body: body.trim(),
    });

    if (rpcError || !data) {
      setError(
        rpcError?.message.includes("NO_ORG")
          ? "Your account is not linked to an organization."
          : "We couldn’t create the chat. Please try again.",
      );
      setLoading(false);
      return;
    }

    router.push(`/pharmacy/${data}`);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {error && (
        <p
          role="alert"
          className="rounded-btn border border-accent/60 bg-accent-tint px-3.5 py-2.5 text-[13px] text-ink"
        >
          {error}
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="title">Chat title</Label>
        <Input
          id="title"
          required
          value={title}
          maxLength={140}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g. Query on order #4211"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <select
            id="category"
            value={category}
            onChange={(event) => setCategory(event.target.value as TopicCategory)}
            className="w-full rounded-btn border border-line bg-sunken px-3.5 py-2.5 text-[15px] text-ink focus:border-accent focus:outline-none"
          >
            {CATEGORY_ORDER.map((key) => (
              <option key={key} value={key}>
                {CATEGORY_LABELS[key]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label>Priority</Label>
          <div className="flex rounded-btn border border-line p-0.5">
            {(["normal", "urgent"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setPriority(value)}
                aria-pressed={priority === value}
                className={cn(
                  "label-mono flex-1 rounded-[2px] px-3 py-2 transition-colors",
                  priority === value
                    ? value === "urgent"
                      ? "bg-accent text-white"
                      : "bg-accent-tint text-ink"
                    : "text-muted hover:text-ink",
                )}
              >
                {value === "urgent" ? "Urgent" : "Normal"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="body">First message</Label>
        <textarea
          id="body"
          required
          rows={6}
          maxLength={MAX}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          className="w-full resize-y rounded-btn border border-line bg-sunken px-3.5 py-3 text-[15px] text-ink placeholder:text-muted/60 focus:border-accent focus:outline-none"
          placeholder="Describe your query. Never include patient names."
        />
        <p className="label-mono text-right text-muted">
          {body.length} / {MAX}
        </p>
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
          {loading ? "Creating" : "Create chat"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
