"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2, Plus, ShieldCheck, Trash2, UserCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AdminFeature, AdminOrg, AdminUser } from "@/lib/admin";
import { cn } from "@/lib/utils";

const FEATURE_LABELS: Record<string, string> = {
  employee_team_chat: "Team Chat — employees chat inside this app",
  employee_pharmacy_topics: "Pharmacy Chat — shared chat with Pharma Portal",
};

function mapError(message: string): string {
  const m = message.toUpperCase();
  if (m.includes("FORBIDDEN")) return "You don’t have permission to do that.";
  if (m.includes("SELF")) return "You can’t change your own role.";
  if (m.includes("BAD_ORG")) return "Pick an organization first.";
  if (m.includes("BAD_NAME")) return "Enter a valid organization name.";
  if (m.includes("BAD_ROLE")) return "That role isn’t allowed.";
  return "Something went wrong. Please try again.";
}

export function AdminConsole({
  users,
  organizations,
  currentUserId,
  isSuperAdmin,
  defaultOrg,
}: {
  users: AdminUser[];
  organizations: AdminOrg[];
  currentUserId: string;
  isSuperAdmin: boolean;
  defaultOrg: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [newOrg, setNewOrg] = useState("");
  const [assignOrg, setAssignOrg] = useState<Record<string, string>>({});

  const [featureOrg, setFeatureOrg] = useState(defaultOrg);
  const [features, setFeatures] = useState<AdminFeature[] | null>(null);

  const pending = users.filter((u) => u.status !== "active");
  const approved = users.filter((u) => u.status === "active");

  const act = useCallback(
    async (
      key: string,
      rpc: string,
      args: Record<string, unknown>,
      success: string,
    ) => {
      setBusy(key);
      setError(null);
      setNotice(null);
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc(rpc, args);
      setBusy(null);
      if (rpcError) {
        setError(mapError(rpcError.message));
        return false;
      }
      setNotice(success);
      router.refresh();
      return true;
    },
    [router],
  );

  const loadFeatures = useCallback(async (org: string) => {
    if (!org) {
      setFeatures([]);
      return;
    }
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("admin_list_features", {
      p_organization: org,
    });
    if (rpcError) {
      setFeatures([]);
      return;
    }
    setFeatures((data ?? []) as AdminFeature[]);
  }, []);

  useEffect(() => {
    void loadFeatures(featureOrg);
  }, [featureOrg, loadFeatures]);

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

      {/* Pending approvals -------------------------------------------------- */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-accent-soft" aria-hidden="true" />
          <h2 className="font-serif text-xl text-ink">Pending approvals</h2>
          {pending.length > 0 && (
            <span className="label-mono rounded-full bg-accent px-2 py-0.5 text-white">
              {pending.length}
            </span>
          )}
        </div>

        {pending.length === 0 ? (
          <div className="rounded-ledger border border-line bg-raised p-6 text-[14px] text-muted">
            No one is waiting for approval.
          </div>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-ledger border border-line bg-raised">
            {pending.map((user) => {
              const selected = assignOrg[user.id] ?? defaultOrg;
              return (
                <li
                  key={user.id}
                  className="flex flex-wrap items-center gap-3 px-5 py-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] text-ink">
                      {user.full_name ?? "Unnamed user"}
                    </p>
                    <p className="label-mono truncate text-muted">
                      {user.email ?? "—"}
                    </p>
                  </div>
                  <select
                    value={selected}
                    onChange={(event) =>
                      setAssignOrg((prev) => ({
                        ...prev,
                        [user.id]: event.target.value,
                      }))
                    }
                    aria-label={`Organization for ${user.email ?? "user"}`}
                    className="rounded-btn border border-line bg-sunken px-3 py-2 text-[14px] text-ink focus:border-accent focus:outline-none"
                  >
                    <option value="">Select organization…</option>
                    {organizations.map((org) => (
                      <option key={org.name} value={org.name}>
                        {org.name}
                      </option>
                    ))}
                    {selected &&
                      !organizations.some((o) => o.name === selected) && (
                        <option value={selected}>{selected}</option>
                      )}
                  </select>
                  <Button
                    onClick={() =>
                      void act(
                        `approve-${user.id}`,
                        "admin_approve_user",
                        { p_user_id: user.id, p_organization: selected },
                        `${user.email ?? "User"} approved.`,
                      )
                    }
                    disabled={busy !== null || !selected}
                  >
                    {busy === `approve-${user.id}` ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    Approve
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* People ------------------------------------------------------------- */}
      <section className="space-y-3">
        <h2 className="font-serif text-xl text-ink">People</h2>
        {approved.length === 0 ? (
          <div className="rounded-ledger border border-line bg-raised p-6 text-[14px] text-muted">
            No approved users yet.
          </div>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-ledger border border-line bg-raised">
            {approved.map((user) => {
              const isSelf = user.id === currentUserId;
              const isSuper = user.role === "super_admin";
              return (
                <li
                  key={user.id}
                  className="flex flex-wrap items-center gap-3 px-5 py-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] text-ink">
                      {user.full_name ?? "Unnamed user"}
                      {isSelf && (
                        <span className="label-mono ml-2 text-muted">You</span>
                      )}
                    </p>
                    <p className="label-mono truncate text-muted">
                      {user.email ?? "—"}
                      {user.organization ? ` · ${user.organization}` : ""}
                    </p>
                  </div>

                  {isSuperAdmin && !isSuper && (
                    <select
                      value={user.organization ?? ""}
                      onChange={(event) =>
                        void act(
                          `org-${user.id}`,
                          "admin_set_user_organization",
                          {
                            p_user_id: user.id,
                            p_organization: event.target.value,
                          },
                          "Organization updated.",
                        )
                      }
                      aria-label={`Organization for ${user.email ?? "user"}`}
                      className="rounded-btn border border-line bg-sunken px-3 py-2 text-[14px] text-ink focus:border-accent focus:outline-none"
                    >
                      <option value="">No organization</option>
                      {organizations.map((org) => (
                        <option key={org.name} value={org.name}>
                          {org.name}
                        </option>
                      ))}
                    </select>
                  )}

                  {isSuper ? (
                    <span className="label-mono rounded-btn border border-accent bg-accent-tint px-2.5 py-1.5 text-accent-soft">
                      Platform admin
                    </span>
                  ) : (
                    <select
                      value={user.role ?? "employee"}
                      disabled={isSelf || busy !== null}
                      onChange={(event) =>
                        void act(
                          `role-${user.id}`,
                          "admin_set_role",
                          { p_user_id: user.id, p_role: event.target.value },
                          "Role updated.",
                        )
                      }
                      aria-label={`Role for ${user.email ?? "user"}`}
                      className="rounded-btn border border-line bg-sunken px-3 py-2 text-[14px] text-ink focus:border-accent focus:outline-none disabled:opacity-50"
                    >
                      <option value="employee">Employee</option>
                      <option value="admin">Admin</option>
                    </select>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Organizations ------------------------------------------------------ */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-accent-soft" aria-hidden="true" />
          <h2 className="font-serif text-xl text-ink">Organizations</h2>
        </div>

        {isSuperAdmin && (
          <div className="max-w-xl space-y-2 rounded-ledger border border-line bg-raised p-5">
            <Label htmlFor="new-org">Create an organization</Label>
            <div className="flex gap-2">
              <Input
                id="new-org"
                value={newOrg}
                maxLength={80}
                onChange={(event) => setNewOrg(event.target.value)}
                placeholder="e.g. Riverside Pharmacy"
              />
              <Button
                onClick={async () => {
                  const name = newOrg.trim();
                  if (!name) return;
                  const ok = await act(
                    "create-org",
                    "admin_create_organization",
                    { p_name: name },
                    `“${name}” created.`,
                  );
                  if (ok) setNewOrg("");
                }}
                disabled={busy !== null || !newOrg.trim()}
              >
                {busy === "create-org" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                Create
              </Button>
            </div>
          </div>
        )}

        {organizations.length === 0 ? (
          <div className="rounded-ledger border border-line bg-raised p-6 text-[14px] text-muted">
            No organizations yet. Create one above.
          </div>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-ledger border border-line bg-raised">
            {organizations.map((org) => (
              <li
                key={org.name}
                className="flex items-center gap-3 px-5 py-3.5"
              >
                <span className="min-w-0 flex-1 truncate text-[15px] text-ink">
                  {org.name}
                </span>
                <span className="label-mono text-muted">
                  {org.member_count}{" "}
                  {org.member_count === 1 ? "member" : "members"}
                </span>
                {isSuperAdmin && (
                  <button
                    type="button"
                    onClick={() =>
                      void act(
                        `del-org-${org.name}`,
                        "admin_delete_organization",
                        { p_name: org.name },
                        `“${org.name}” deleted.`,
                      )
                    }
                    disabled={busy !== null}
                    aria-label={`Delete ${org.name}`}
                    className="text-muted transition-colors hover:text-accent-soft disabled:opacity-50"
                  >
                    {busy === `del-org-${org.name}` ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Feature flags (super-admin only) ----------------------------------- */}
      {isSuperAdmin && (
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-accent-soft" aria-hidden="true" />
          <h2 className="font-serif text-xl text-ink">Features</h2>
        </div>

        <div className="max-w-2xl space-y-4 rounded-ledger border border-line bg-raised p-5">
          <div className="space-y-2">
            <Label htmlFor="feature-org">Organization</Label>
            <select
              id="feature-org"
              value={featureOrg}
              onChange={(event) => setFeatureOrg(event.target.value)}
              className="w-full rounded-btn border border-line bg-sunken px-3 py-2.5 text-[15px] text-ink focus:border-accent focus:outline-none"
            >
              <option value="">Select organization…</option>
              {organizations.map((org) => (
                <option key={org.name} value={org.name}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>

          {!featureOrg ? (
            <p className="text-[14px] text-muted">
              Choose an organization to manage its features.
            </p>
          ) : features === null ? (
            <p className="text-[14px] text-muted">Loading…</p>
          ) : (
            <ul className="space-y-3">
              {features.map((flag) => (
                <li
                  key={flag.feature_key}
                  className="flex items-center justify-between gap-4"
                >
                  <span className="text-[14px] text-ink">
                    {FEATURE_LABELS[flag.feature_key] ?? flag.feature_key}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={flag.enabled}
                    aria-label={flag.feature_key}
                    disabled={busy !== null}
                    onClick={() =>
                      void act(
                        `feat-${flag.feature_key}`,
                        "admin_set_feature",
                        {
                          p_organization: featureOrg,
                          p_feature_key: flag.feature_key,
                          p_enabled: !flag.enabled,
                        },
                        "Feature updated.",
                      ).then((ok) => {
                        if (ok) void loadFeatures(featureOrg);
                      })
                    }
                    className={cn(
                      "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50",
                      flag.enabled ? "bg-accent" : "bg-line",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all",
                        flag.enabled ? "left-[22px]" : "left-0.5",
                      )}
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
      )}
    </div>
  );
}
