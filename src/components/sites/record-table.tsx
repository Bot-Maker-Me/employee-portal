"use client";

import { useEffect, useState, useTransition, type CSSProperties } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ChevronDown,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteRecord, importRecords, saveRecord } from "@/lib/sites/actions";
import {
  RECORD_CONFIGS,
  parsePastedRows,
  type RecordEntity,
  type RecordRow,
} from "@/lib/sites/records";
import { cn } from "@/lib/utils";

const TEXTAREA =
  "w-full rounded-btn border border-line bg-sunken px-3.5 py-2.5 text-[15px] text-ink placeholder:text-muted/60 transition-colors focus:border-accent focus:outline-none";

/** Search box that keeps the query in the URL (`?q=`) so results are server-filtered. */
function SearchBox({ placeholder }: { placeholder: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const current = params.get("q") ?? "";
    if (value.trim() === current) return;
    const timer = window.setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (value.trim()) next.set("q", value.trim());
      else next.delete("q");
      startTransition(() => {
        router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [value, params, pathname, router]);

  return (
    <div className="relative w-full max-w-md">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
        aria-hidden="true"
      />
      <Input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="pl-9 pr-9"
      />
      {pending && (
        <Loader2
          className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted"
          aria-hidden="true"
        />
      )}
    </div>
  );
}

function RecordForm({
  entity,
  initial,
  organization,
  pharmacyId,
  onClose,
}: {
  entity: RecordEntity;
  initial: RecordRow | null;
  organization?: string | null;
  pharmacyId?: string | null;
  onClose: (message?: string) => void;
}) {
  const config = RECORD_CONFIGS[entity];
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() => {
    const start: Record<string, string> = {};
    for (const field of config.fields) start[field.key] = initial?.[field.key] ?? "";
    return start;
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await saveRecord({
        entity,
        id: initial?.id ?? null,
        organization,
        pharmacyId,
        values,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
      onClose(result.message);
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
      <p className="font-serif text-lg text-ink">
        {initial ? `Edit ${config.singular}` : `Add a ${config.singular}`}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {config.fields.map((field) => (
          <div key={field.key} className={cn("space-y-1.5", field.multiline && "sm:col-span-2")}>
            <Label htmlFor={`f-${field.key}`}>
              {field.label}
              {field.required && <span className="text-accent-soft"> *</span>}
            </Label>
            {field.multiline ? (
              <textarea
                id={`f-${field.key}`}
                rows={3}
                maxLength={field.max}
                value={values[field.key]}
                onChange={(event) => setValues((v) => ({ ...v, [field.key]: event.target.value }))}
                className={TEXTAREA}
              />
            ) : (
              <Input
                id={`f-${field.key}`}
                maxLength={field.max}
                required={field.required}
                value={values[field.key]}
                onChange={(event) => setValues((v) => ({ ...v, [field.key]: event.target.value }))}
                className={cn(field.mono && "font-mono")}
              />
            )}
          </div>
        ))}
      </div>
      {error && <p className="text-[13px] text-warn">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
          Save
        </Button>
        <Button variant="ghost" onClick={() => onClose()} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function ImportPanel({
  entity,
  organization,
  pharmacyId,
  onClose,
}: {
  entity: RecordEntity;
  organization?: string | null;
  pharmacyId?: string | null;
  onClose: (message?: string) => void;
}) {
  const config = RECORD_CONFIGS[entity];
  const router = useRouter();
  const [text, setText] = useState("");
  const [skipHeader, setSkipHeader] = useState(true);
  const [replace, setReplace] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const rows = parsePastedRows(text);
  const usable = skipHeader ? rows.slice(1) : rows;

  function readFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await importRecords({ entity, organization, pharmacyId, rows: usable, replace });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
      onClose(result.message);
    });
  }

  return (
    <div className="animate-rise-sm space-y-4 rounded-ledger border border-accent-ring bg-raised p-5">
      <div>
        <p className="font-serif text-lg text-ink">Import {config.plural}</p>
        <p className="mt-1 text-[13px] text-muted">
          Paste rows copied from Excel, or choose a .csv file. Columns, in this order:
        </p>
        <p className="label-mono mt-2 text-accent-soft">
          {config.fields.map((field) => field.label).join("  ·  ")}
        </p>
      </div>
      <textarea
        rows={8}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Paste rows here…"
        className={cn(TEXTAREA, "font-mono text-[13px]")}
      />
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-[13px] text-muted">
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input
            type="file"
            accept=".csv,.tsv,.txt,text/csv"
            className="sr-only"
            onChange={(event) => event.target.files?.[0] && readFile(event.target.files[0])}
          />
          <span className="label-mono rounded-btn border border-line px-3 py-2 text-ink hover:border-accent">
            Choose CSV file
          </span>
        </label>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={skipHeader} onChange={(e) => setSkipHeader(e.target.checked)} />
          First row is a header
        </label>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
          Replace everything currently in the list
        </label>
      </div>
      {error && <p className="text-[13px] text-warn">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={submit} disabled={pending || usable.length === 0}>
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
          Import {usable.length} {usable.length === 1 ? "row" : "rows"}
        </Button>
        <Button variant="ghost" onClick={() => onClose()} disabled={pending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function RecordTable({
  entity,
  rows,
  total,
  truncated,
  canEdit,
  organization,
  pharmacyId,
  searchPlaceholder,
}: {
  entity: RecordEntity;
  rows: RecordRow[];
  total: number;
  truncated: boolean;
  canEdit: boolean;
  organization?: string | null;
  pharmacyId?: string | null;
  searchPlaceholder: string;
}) {
  const config = RECORD_CONFIGS[entity];
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<"none" | "add" | "import">("none");
  const [editing, setEditing] = useState<RecordRow | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const listed = config.fields.filter((field) => field.list !== false && !field.multiline);
  const details = config.fields.filter((field) => field.list === false || field.multiline);
  const searching = Boolean(params.get("q"));

  function closeForms(message?: string) {
    setMode("none");
    setEditing(null);
    if (message) setNotice(message);
  }

  function remove(row: RecordRow) {
    const label = row[config.fields[0].key];
    if (!window.confirm(`Delete “${label}”?`)) return;
    setDeleting(row.id);
    setError(null);
    startTransition(async () => {
      const result = await deleteRecord({ entity, id: row.id });
      setDeleting(null);
      if (!result.ok) setError(result.message);
      else {
        setNotice(result.message);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <SearchBox placeholder={searchPlaceholder} />
        <span className="label-mono text-muted">
          {truncated ? `Showing 300 of ${total}` : `${total} ${total === 1 ? config.singular : config.plural}`}
        </span>
        {canEdit && (
          <div className="ml-auto flex gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setEditing(null);
                setMode(mode === "import" ? "none" : "import");
              }}
            >
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              Import
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setMode(mode === "add" ? "none" : "add");
              }}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Add
            </Button>
          </div>
        )}
      </div>

      {notice && (
        <p className="flex items-center justify-between rounded-btn border border-line bg-raised px-4 py-2.5 text-[13px] text-ok">
          {notice}
          <button onClick={() => setNotice(null)} aria-label="Dismiss" className="text-muted hover:text-ink">
            <X className="h-3.5 w-3.5" />
          </button>
        </p>
      )}
      {error && <p className="text-[13px] text-warn">{error}</p>}

      {canEdit && mode === "add" && (
        <RecordForm
          entity={entity}
          initial={null}
          organization={organization}
          pharmacyId={pharmacyId}
          onClose={closeForms}
        />
      )}
      {canEdit && mode === "import" && (
        <ImportPanel
          entity={entity}
          organization={organization}
          pharmacyId={pharmacyId}
          onClose={closeForms}
        />
      )}
      {canEdit && editing && (
        <RecordForm
          key={editing.id}
          entity={entity}
          initial={editing}
          organization={organization}
          pharmacyId={pharmacyId}
          onClose={closeForms}
        />
      )}

      {rows.length === 0 ? (
        <div className="rounded-ledger border border-line bg-raised p-8 text-center">
          <p className="text-[15px] text-ink">
            {searching ? "Nothing matches that search." : `No ${config.plural} yet.`}
          </p>
          {!searching && (
            <p className="mt-1.5 text-[14px] text-muted">
              {canEdit
                ? `Use Add or Import to load ${config.plural}.`
                : "An administrator hasn’t added any yet."}
            </p>
          )}
        </div>
      ) : (
        <div className="scroll-slim overflow-x-auto rounded-ledger border border-line bg-raised">
          <table className="w-full min-w-[640px] text-left text-[14px]">
            <thead>
              <tr className="border-b border-line">
                {listed.map((field) => (
                  <th key={field.key} scope="col" className="label-mono px-4 py-3 font-normal text-muted">
                    {field.label}
                  </th>
                ))}
                <th scope="col" className="w-px px-4 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row, index) => {
                const hasDetails = details.some((field) => row[field.key]);
                const expanded = open === row.id;
                return (
                  <tr
                    key={row.id}
                    className="animate-rise stagger align-top transition-colors hover:bg-sunken"
                    style={{ "--i": Math.min(index, 12) } as CSSProperties}
                  >
                    {listed.map((field, col) => (
                      <td
                        key={field.key}
                        className={cn(
                          "px-4 py-3",
                          col === 0 ? "text-ink" : "text-muted",
                          field.mono && "font-mono text-[13px] text-accent-soft",
                        )}
                      >
                        {row[field.key] || <span className="text-muted/50">—</span>}
                        {col === 0 && expanded && (
                          <div className="mt-2 space-y-1.5">
                            {details.map((detail) =>
                              row[detail.key] ? (
                                <p key={detail.key} className="whitespace-pre-wrap text-[13px] text-muted">
                                  <span className="label-mono mr-2 text-accent-soft">{detail.label}</span>
                                  {row[detail.key]}
                                </p>
                              ) : null,
                            )}
                          </div>
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        {hasDetails && (
                          <button
                            onClick={() => setOpen(expanded ? null : row.id)}
                            className="rounded-btn p-1.5 text-muted hover:bg-raised hover:text-ink"
                            aria-label={expanded ? "Hide notes" : "Show notes"}
                            aria-expanded={expanded}
                          >
                            <ChevronDown
                              className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")}
                            />
                          </button>
                        )}
                        {canEdit && (
                          <>
                            <button
                              onClick={() => {
                                setMode("none");
                                setEditing(row);
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              }}
                              className="rounded-btn p-1.5 text-muted hover:bg-raised hover:text-ink"
                              aria-label="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => remove(row)}
                              disabled={deleting === row.id}
                              className="rounded-btn p-1.5 text-muted hover:bg-raised hover:text-accent-soft"
                              aria-label="Delete"
                            >
                              {deleting === row.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
