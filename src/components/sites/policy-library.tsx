"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, ChevronDown, ExternalLink, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deletePolicy, savePolicy } from "@/lib/sites/actions";
import type { Policy } from "@/lib/sites/data";
import { formatFullStamp } from "@/lib/format";
import { cn } from "@/lib/utils";

const TEXTAREA =
  "w-full rounded-btn border border-line bg-sunken px-3.5 py-2.5 text-[15px] text-ink placeholder:text-muted/60 transition-colors focus:border-accent focus:outline-none";

function PolicyForm({
  pharmacyId,
  initial,
  categories,
  onClose,
}: {
  pharmacyId: string;
  initial: Policy | null;
  categories: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [linkUrl, setLinkUrl] = useState(initial?.link_url ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await savePolicy({ id: initial?.id ?? null, pharmacyId, title, category, body, linkUrl });
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
      <p className="font-serif text-lg text-ink">{initial ? "Edit policy" : "Add a policy or procedure"}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="p-title">Title</Label>
          <Input id="p-title" value={title} maxLength={160} required onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-category">Category</Label>
          <Input
            id="p-category"
            list="policy-categories"
            value={category}
            maxLength={60}
            placeholder="e.g. Dispensing, Narcotics, Opening/Closing"
            onChange={(e) => setCategory(e.target.value)}
          />
          <datalist id="policy-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="p-body">Procedure text</Label>
        <textarea
          id="p-body"
          rows={10}
          maxLength={50000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className={TEXTAREA}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="p-link">Link to document (optional)</Label>
        <Input
          id="p-link"
          type="url"
          value={linkUrl}
          placeholder="https://… (PDF on SharePoint, Google Drive, etc.)"
          onChange={(e) => setLinkUrl(e.target.value)}
        />
      </div>
      {error && <p className="text-[13px] text-warn">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
          Save
        </Button>
        <Button variant="ghost" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function PolicyLibrary({
  pharmacyId,
  policies,
  canEdit,
}: {
  pharmacyId: string;
  policies: Policy[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Policy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const categories = useMemo(
    () => Array.from(new Set(policies.map((p) => p.category).filter(Boolean))).sort(),
    [policies],
  );

  const grouped = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = needle
      ? policies.filter((p) => `${p.title} ${p.category} ${p.body}`.toLowerCase().includes(needle))
      : policies;
    const groups = new Map<string, Policy[]>();
    for (const policy of matches) {
      const key = policy.category || "General";
      groups.set(key, [...(groups.get(key) ?? []), policy]);
    }
    return Array.from(groups.entries());
  }, [policies, query]);

  function remove(policy: Policy) {
    if (!window.confirm(`Delete “${policy.title}”?`)) return;
    startTransition(async () => {
      const result = await deletePolicy({ id: policy.id });
      if (!result.ok) setError(result.message);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search policies and procedures"
            aria-label="Search policies and procedures"
            className="pl-9"
          />
        </div>
        {canEdit && !adding && !editing && (
          <Button className="ml-auto" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Add policy
          </Button>
        )}
      </div>

      {canEdit && adding && (
        <PolicyForm pharmacyId={pharmacyId} initial={null} categories={categories} onClose={() => setAdding(false)} />
      )}
      {canEdit && editing && (
        <PolicyForm
          key={editing.id}
          pharmacyId={pharmacyId}
          initial={editing}
          categories={categories}
          onClose={() => setEditing(null)}
        />
      )}
      {error && <p className="text-[13px] text-warn">{error}</p>}

      {grouped.length === 0 ? (
        <div className="rounded-ledger border border-line bg-raised p-8 text-center">
          <p className="text-[15px] text-ink">
            {query ? "Nothing matches that search." : "No policies or procedures yet."}
          </p>
          {!query && (
            <p className="mt-1.5 text-[14px] text-muted">
              {canEdit ? "Add the first one with Add policy." : "An administrator hasn’t added any yet."}
            </p>
          )}
        </div>
      ) : (
        grouped.map(([category, items]) => (
          <section key={category} className="space-y-2">
            <h2 className="label-mono text-accent-soft">{category}</h2>
            <ul className="divide-y divide-line overflow-hidden rounded-ledger border border-line bg-raised">
              {items.map((policy) => {
                const expanded = open === policy.id;
                return (
                  <li key={policy.id}>
                    <div className="flex items-center gap-3 px-5 py-3.5">
                      <button
                        onClick={() => setOpen(expanded ? null : policy.id)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        aria-expanded={expanded}
                      >
                        <BookOpen className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                        <span className="truncate text-[15px] text-ink">{policy.title}</span>
                        <ChevronDown
                          className={cn("ml-auto h-4 w-4 shrink-0 text-muted transition-transform", expanded && "rotate-180")}
                          aria-hidden="true"
                        />
                      </button>
                      {canEdit && (
                        <div className="flex shrink-0 gap-1">
                          <button
                            onClick={() => {
                              setAdding(false);
                              setEditing(policy);
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                            className="rounded-btn p-1.5 text-muted hover:bg-sunken hover:text-ink"
                            aria-label="Edit policy"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => remove(policy)}
                            className="rounded-btn p-1.5 text-muted hover:bg-sunken hover:text-accent-soft"
                            aria-label="Delete policy"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                    {expanded && (
                      <div className="animate-rise-sm border-t border-line bg-sunken px-5 py-4">
                        {policy.body ? (
                          <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-ink">{policy.body}</p>
                        ) : (
                          <p className="text-[14px] text-muted">No text — see the linked document.</p>
                        )}
                        <div className="mt-3 flex flex-wrap items-center gap-4">
                          {policy.link_url && (
                            <a
                              href={policy.link_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="label-mono inline-flex items-center gap-1.5 text-accent-soft hover:underline"
                            >
                              Open document <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                            </a>
                          )}
                          <span className="label-mono text-muted/70">Updated {formatFullStamp(policy.updated_at)}</span>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
