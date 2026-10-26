"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  KeyRound,
  Loader2,
  Plus,
  Power,
  PowerOff,
  Search,
  ShieldAlert,
  UserCog,
  Users,
  X,
} from "lucide-react";
import {
  adminBulkCreateUsers,
  adminCheckUsername,
  adminCreateUser,
  adminSetTemporaryPassword,
  adminSetUserActive,
  adminSetUsername,
} from "@/lib/admin/actions";
import type { ManagedUser } from "@/lib/auth/store";
import { USERNAME_HINT, normalizeUsername } from "@/lib/auth/username";
import { formatFullStamp } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  TempPasswordList,
  TempPasswordReveal,
} from "@/components/admin/temp-password";
import { cn } from "@/lib/utils";

type CheckResult = { available: boolean; message: string } | null;

type BulkEntry = { username: string; tempPassword: string };

/** Live availability check, debounced so typing does not hammer the server. */
function useUsernameCheck(username: string): CheckResult {
  const [result, setResult] = useState<CheckResult>(null);

  useEffect(() => {
    const value = username.trim().toLowerCase();
    if (value.length < 3) {
      setResult(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void adminCheckUsername({ username: value })
        .then((response) => {
          if (!cancelled) setResult(response);
        })
        .catch(() => {
          if (!cancelled) setResult(null);
        });
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [username]);

  return result;
}

/** Inline "Set username" editor for an existing account. */
function UsernameEditor({
  user,
  onDone,
  onError,
}: {
  user: ManagedUser;
  onDone: () => void;
  onError: (message: string) => void;
}) {
  const router = useRouter();
  const [value, setValue] = useState(user.username ?? "");
  const [pending, startTransition] = useTransition();
  const check = useUsernameCheck(value);
  const unchanged =
    (user.username ?? "").toLowerCase() === value.trim().toLowerCase();

  function save() {
    startTransition(async () => {
      const result = await adminSetUsername({ userId: user.id, username: value });
      if (!result.ok) {
        onError(result.message);
        return;
      }
      onDone();
      router.refresh();
    });
  }

  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      <Input
        aria-label={`Username for ${user.fullName ?? "user"}`}
        value={value}
        maxLength={32}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        onChange={(event) => setValue(event.target.value)}
        placeholder="username"
        className="max-w-[16rem]"
      />
      <Button
        onClick={save}
        disabled={pending || unchanged || check?.available === false}
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        Save
      </Button>
      <Button variant="ghost" onClick={onDone} disabled={pending}>
        <X className="h-3.5 w-3.5" aria-hidden="true" />
        Cancel
      </Button>
      {check && !check.available && (
        <span className="text-[12px] text-warn">{check.message}</span>
      )}
      <span className="text-[12px] text-muted">
        Fills the username only — email, password and role stay as they are.
      </span>
    </div>
  );
}

export function UserAccounts({
  users,
  currentUserId,
  isSuperAdmin,
  organizations,
  defaultOrg,
}: {
  users: ManagedUser[];
  currentUserId: string;
  isSuperAdmin: boolean;
  organizations: string[];
  defaultOrg: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState<ManagedUser | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ title: string; password: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  // Create form
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("employee");
  const [organization, setOrganization] = useState(defaultOrg);
  const check = useUsernameCheck(username);
  // What the server will actually store: trimmed, lowercased, single spaces.
  const savedAs = normalizeUsername(username);

  // Bulk create
  const [bulkPrefix, setBulkPrefix] = useState("staff");
  const [bulkCount, setBulkCount] = useState("10");
  const [bulkStart, setBulkStart] = useState("1");
  const [bulkIssued, setBulkIssued] = useState<BulkEntry[] | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return users;
    return users.filter((user) =>
      `${user.fullName ?? ""} ${user.username ?? ""}`
        .toLowerCase()
        .includes(needle),
    );
  }, [users, query]);

  function create() {
    startTransition(async () => {
      setBusy("create");
      setError(null);
      setNotice(null);
      let result: Awaited<ReturnType<typeof adminCreateUser>>;
      try {
        result = await adminCreateUser({
          fullName,
          username,
          role,
          organization,
        });
      } catch {
        setBusy(null);
        setError("We couldn’t complete that request. Please try again.");
        return;
      }
      setBusy(null);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setIssued({
        title: `Give this to ${fullName.trim() || `@${username.trim()}`} — they must change it when they sign in.`,
        password: result.tempPassword ?? "",
      });
      setNotice(result.message);
      setFullName("");
      setUsername("");
      setRole("employee");
      router.refresh();
    });
  }

  function bulkCreate() {
    startTransition(async () => {
      setBusy("bulk");
      setError(null);
      setNotice(null);
      setBulkIssued(null);
      let result: Awaited<ReturnType<typeof adminBulkCreateUsers>>;
      try {
        result = await adminBulkCreateUsers({
          count: Number(bulkCount) || 0,
          prefix: bulkPrefix,
          startAt: Number(bulkStart) || 1,
          role,
          organization,
        });
      } catch {
        setBusy(null);
        setError("We couldn’t complete that request. Please try again.");
        return;
      }
      setBusy(null);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setBulkIssued(result.created);
      setNotice(result.message);
      router.refresh();
    });
  }

  function resetPassword(user: ManagedUser) {
    startTransition(async () => {
      setBusy(`reset-${user.id}`);
      setError(null);
      setNotice(null);
      let result: Awaited<ReturnType<typeof adminSetTemporaryPassword>>;
      try {
        result = await adminSetTemporaryPassword({ userId: user.id });
      } catch {
        setBusy(null);
        setError("We couldn’t complete that request. Please try again.");
        return;
      }
      setBusy(null);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setIssued({
        title: `Hand this to ${
          user.fullName ?? `@${user.username ?? "the user"}`
        }. This password is shared across all apps they use, so they will need it everywhere.`,
        password: result.tempPassword ?? "",
      });
      router.refresh();
    });
  }

  function toggleActive(user: ManagedUser) {
    startTransition(async () => {
      setBusy(`active-${user.id}`);
      setError(null);
      setNotice(null);
      const result = await adminSetUserActive({
        userId: user.id,
        isActive: !user.appActive,
      });
      setBusy(null);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setNotice(result.message);
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      {error && (
        <p
          role="alert"
          className="max-w-2xl rounded-btn border border-accent/60 bg-accent-tint px-3.5 py-2.5 text-[13px] text-ink"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="max-w-2xl rounded-btn border border-ok/50 bg-raised px-3.5 py-2.5 text-[13px] text-ok"
        >
          {notice}
        </p>
      )}
      {issued && (
        <TempPasswordReveal
          title={issued.title}
          password={issued.password}
          onDismiss={() => setIssued(null)}
        />
      )}

      {bulkIssued && (
        <TempPasswordList
          title="Hand each person their own line. Accounts are created and active in this app only."
          entries={bulkIssued}
          onDismiss={() => setBulkIssued(null)}
        />
      )}

      {confirmReset && (
        <div className="max-w-2xl space-y-3 rounded-ledger border border-warn/60 bg-raised p-5">
          <p className="flex items-start gap-2 text-[14px] text-ink">
            <ShieldAlert
              className="mt-0.5 h-4 w-4 shrink-0 text-warn"
              aria-hidden="true"
            />
            This password is shared across all apps this person uses. They will
            need the new password everywhere.
          </p>
          <p className="text-[13px] text-muted">
            A one-time temporary password will be generated for{" "}
            <span className="text-ink">
              {confirmReset.fullName ?? `@${confirmReset.username ?? "the user"}`}
            </span>{" "}
            and they must change it when they next sign in.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => {
                const user = confirmReset;
                setConfirmReset(null);
                resetPassword(user);
              }}
              disabled={pending || busy !== null}
            >
              <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
              Confirm reset
            </Button>
            <Button variant="secondary" onClick={() => setConfirmReset(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Create an account --------------------------------------------------- */}
      <section className="max-w-2xl space-y-4 rounded-ledger border border-line bg-raised p-5">
        <div className="flex items-center gap-2">
          <Plus className="h-4 w-4 text-accent-soft" aria-hidden="true" />
          <h2 className="font-serif text-xl text-ink">Create an account</h2>
        </div>
        <p className="text-[13px] text-muted">
          The account has no real email address: sign-in here is by username.
          The address this creates is an internal placeholder that is never shown
          and never used for sending.
        </p>

        <div className="space-y-2">
          <Label htmlFor="new-full-name">Full name</Label>
          <Input
            id="new-full-name"
            value={fullName}
            maxLength={120}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Alex Morgan"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="new-username">Username</Label>
          <Input
            id="new-username"
            value={username}
            maxLength={32}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="alex.morgan"
          />
          <p
            className={cn(
              "text-[12px]",
              check && !check.available ? "text-warn" : "text-muted",
            )}
          >
            {check ? check.message : USERNAME_HINT}
          </p>
          {savedAs.length >= 3 && savedAs !== username.trim() && (
            <p className="text-[12px] text-muted">
              Saved and matched as{" "}
              <span className="font-mono text-ink">@{savedAs}</span> — they sign
              in with that, lower case and all.
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="new-role">Role</Label>
            <select
              id="new-role"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              className="w-full rounded-btn border border-line bg-sunken px-3 py-2.5 text-[15px] text-ink focus:border-accent focus:outline-none"
            >
              <option value="employee">Employee</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-org">Organization</Label>
            {isSuperAdmin ? (
              <select
                id="new-org"
                value={organization}
                onChange={(event) => setOrganization(event.target.value)}
                className="w-full rounded-btn border border-line bg-sunken px-3 py-2.5 text-[15px] text-ink focus:border-accent focus:outline-none"
              >
                <option value="">Select organization…</option>
                {organizations.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            ) : (
              <Input id="new-org" value={organization} readOnly disabled />
            )}
          </div>
        </div>

        <Button
          onClick={create}
          disabled={
            pending ||
            busy !== null ||
            fullName.trim().length === 0 ||
            username.trim().length < 3 ||
            !organization ||
            check?.available === false
          }
        >
          {busy === "create" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          Create account &amp; show temporary password
        </Button>
      </section>

      {/* Bulk create --------------------------------------------------------- */}
      <section className="max-w-2xl space-y-4 rounded-ledger border border-line bg-raised p-5">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-accent-soft" aria-hidden="true" />
          <h2 className="font-serif text-xl text-ink">Create a batch</h2>
        </div>
        <p className="text-[13px] text-muted">
          Usernames are <span className="text-ink">{bulkPrefix}001</span>,{" "}
          {bulkPrefix}002… Every account gets its own hidden placeholder address
          and its own temporary password, and must set a new password at first
          sign-in. Rename any username later from the list below.
        </p>
        <p className="flex items-start gap-2 rounded-btn border border-warn/60 px-3.5 py-2.5 text-[13px] text-warn">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          This project is shared with your other apps, so every account you
          create here also appears in their user lists. Keep test batches small.
        </p>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="bulk-prefix">Username prefix</Label>
            <Input
              id="bulk-prefix"
              value={bulkPrefix}
              maxLength={20}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              onChange={(event) => setBulkPrefix(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bulk-count">How many (max 50)</Label>
            <Input
              id="bulk-count"
              type="number"
              min={1}
              max={50}
              value={bulkCount}
              onChange={(event) => setBulkCount(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bulk-start">Start at number</Label>
            <Input
              id="bulk-start"
              type="number"
              min={1}
              max={99999}
              value={bulkStart}
              onChange={(event) => setBulkStart(event.target.value)}
            />
          </div>
        </div>

        <p className="text-[13px] text-muted">
          Role and organization for the batch are the ones selected in “Create an
          account” above: <span className="text-ink">{role}</span>
          {organization ? ` · ${organization}` : ""}.
        </p>

        <Button
          onClick={bulkCreate}
          disabled={pending || busy !== null || !organization}
        >
          {busy === "bulk" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          Create batch &amp; show temporary passwords
        </Button>
      </section>

      {/* Accounts ------------------------------------------------------------ */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-serif text-xl text-ink">Accounts</h2>
          <span className="label-mono text-muted">{filtered.length} shown</span>
        </div>

        <div className="relative max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search username or name"
            aria-label="Search accounts"
            className="pl-9"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-ledger border border-line bg-raised p-6 text-[14px] text-muted">
            No accounts match that search.
          </div>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-ledger border border-line bg-raised">
            {filtered.map((user) => {
              const isSelf = user.id === currentUserId;
              return (
                <li key={user.id} className="space-y-3 px-5 py-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] text-ink">
                        {user.fullName ?? "Unnamed user"}
                        {isSelf && (
                          <span className="label-mono ml-2 text-muted">You</span>
                        )}
                      </p>
                      <p className="label-mono truncate text-muted">
                        {user.username ? `@${user.username}` : "No username yet"}
                        {user.organization ? ` · ${user.organization}` : ""}
                        {" · "}
                        {user.role ?? "employee"}
                      </p>
                    </div>

                    <span
                      className={cn(
                        "label-mono rounded-btn border px-2.5 py-1.5",
                        user.appActive
                          ? "border-ok/50 text-ok"
                          : "border-accent text-accent-soft",
                      )}
                    >
                      {user.appActive ? "Active here" : "Disabled here"}
                    </span>

                    {user.status !== "active" && (
                      <span className="label-mono rounded-btn border border-warn/60 px-2.5 py-1.5 text-warn">
                        Awaiting approval
                      </span>
                    )}

                    <span className="label-mono text-muted">
                      {user.lastLoginAt
                        ? `Last in ${formatFullStamp(user.lastLoginAt)}`
                        : "Never signed in"}
                    </span>

                    <Button
                      variant="secondary"
                      onClick={() => {
                        setEditing(editing === user.id ? null : user.id);
                        setError(null);
                      }}
                      disabled={pending || busy !== null}
                    >
                      <UserCog className="h-3.5 w-3.5" aria-hidden="true" />
                      {user.username ? "Change username" : "Set username"}
                    </Button>

                    <Button
                      variant="secondary"
                      onClick={() => {
                        setError(null);
                        setConfirmReset(user);
                      }}
                      disabled={pending || busy !== null}
                    >
                      {busy === `reset-${user.id}` ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      Reset password
                    </Button>

                    {isSelf ? (
                      <span className="flex items-center gap-1.5 text-[12px] text-muted">
                        <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                        You can’t disable yourself
                      </span>
                    ) : (
                      <Button
                        variant={user.appActive ? "ghost" : "secondary"}
                        onClick={() => toggleActive(user)}
                        disabled={pending || busy !== null}
                      >
                        {busy === `active-${user.id}` ? (
                          <Loader2
                            className="h-3.5 w-3.5 animate-spin"
                            aria-hidden="true"
                          />
                        ) : user.appActive ? (
                          <PowerOff className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                          <Power className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        {user.appActive ? "Deactivate here" : "Reactivate here"}
                      </Button>
                    )}
                  </div>

                  {editing === user.id && (
                    <UsernameEditor
                      user={user}
                      onDone={() => setEditing(null)}
                      onError={(message) => setError(message)}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
