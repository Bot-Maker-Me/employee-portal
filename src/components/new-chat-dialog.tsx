"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, User, Users, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DirectoryEntry } from "@/lib/channels";
import { cn } from "@/lib/utils";

type Mode = "direct" | "group";

export function NewChatDialog({
  directory,
  currentUserId,
}: {
  directory: DirectoryEntry[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("direct");
  const [directId, setDirectId] = useState<string>("");
  const [groupName, setGroupName] = useState("");
  const [groupIds, setGroupIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const colleagues = useMemo(
    () => directory.filter((person) => person.id !== currentUserId),
    [directory, currentUserId],
  );

  function reset() {
    setMode("direct");
    setDirectId("");
    setGroupName("");
    setGroupIds(new Set());
    setError(null);
    setLoading(false);
  }

  function toggleGroup(id: string) {
    setGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    setError(null);

    const memberIds = mode === "direct" ? [directId] : Array.from(groupIds);

    if (mode === "direct" && !directId) {
      setError("Pick a colleague to message.");
      return;
    }
    if (mode === "group" && !groupName.trim()) {
      setError("Give the group a name.");
      return;
    }
    if (mode === "group" && groupIds.size === 0) {
      setError("Add at least one colleague to the group.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc(
      "create_employee_channel",
      {
        p_type: mode,
        p_name: mode === "group" ? groupName.trim() : "",
        p_member_ids: memberIds,
      },
    );

    if (rpcError || !data) {
      setError("We couldn’t start that chat. Please try again.");
      setLoading(false);
      return;
    }

    setOpen(false);
    reset();
    router.push(`/team/${data}`);
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Users className="h-3.5 w-3.5" aria-hidden="true" />
        New chat
      </Button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="New chat"
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-5 animate-fade-in"
        >
          <div className="w-full max-w-md rounded-ledger border border-line bg-raised p-6 shadow-raised">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-xl text-ink">New chat</h2>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
                className="text-muted transition-colors hover:text-ink"
                aria-label="Close"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 flex rounded-btn border border-line p-0.5">
              {(["direct", "group"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  aria-pressed={mode === value}
                  className={cn(
                    "label-mono flex-1 rounded-[2px] px-3 py-2 transition-colors",
                    mode === value
                      ? "bg-accent-tint text-ink"
                      : "text-muted hover:text-ink",
                  )}
                >
                  {value === "direct" ? "Direct" : "Group"}
                </button>
              ))}
            </div>

            {error && (
              <p role="alert" className="mt-4 text-[13px] text-accent-soft">
                {error}
              </p>
            )}

            {mode === "group" && (
              <div className="mt-4 space-y-2">
                <Label htmlFor="group-name">Group name</Label>
                <Input
                  id="group-name"
                  value={groupName}
                  maxLength={80}
                  onChange={(event) => setGroupName(event.target.value)}
                  placeholder="e.g. Night shift"
                />
              </div>
            )}

            <p className="label-mono mt-4 text-muted">
              {mode === "direct" ? "Pick a colleague" : "Add colleagues"}
            </p>

            {colleagues.length === 0 ? (
              <p className="mt-3 text-[14px] text-muted">
                No colleagues found in your organization.
              </p>
            ) : (
              <ul className="mt-3 max-h-60 space-y-1 overflow-y-auto">
                {colleagues.map((person) => {
                  const active =
                    mode === "direct"
                      ? directId === person.id
                      : groupIds.has(person.id);
                  return (
                    <li key={person.id}>
                      <button
                        type="button"
                        onClick={() =>
                          mode === "direct"
                            ? setDirectId(person.id)
                            : toggleGroup(person.id)
                        }
                        aria-pressed={active}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-btn border px-3 py-2.5 text-left text-[15px] transition-colors",
                          active
                            ? "border-accent bg-accent-tint text-ink"
                            : "border-line text-muted hover:text-ink",
                        )}
                      >
                        <User className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span className="truncate">{person.full_name}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mt-5 flex gap-3">
              <Button onClick={submit} disabled={loading} className="flex-1">
                {loading && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                )}
                {loading ? "Starting" : "Start chat"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
