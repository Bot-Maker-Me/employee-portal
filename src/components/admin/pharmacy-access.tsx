"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, Loader2, Plus, Search, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deletePharmacy, savePharmacy, setPharmacyAccess } from "@/lib/sites/actions";
import type { PortalPharmacy } from "@/lib/sites/data";
import { cn } from "@/lib/utils";

type AccessUser = {
  id: string;
  name: string;
  username: string | null;
  organization: string;
  isAdmin: boolean;
  appActive: boolean;
};

type Tenant = { id: string; name: string };

const SELECT =
  "w-full rounded-btn border border-line bg-sunken px-3 py-2.5 text-[14px] text-ink focus:border-accent focus:outline-none";

/** Checkbox grid: who (rows) can see which pharmacy (columns). */
function AccessMatrix({
  organization,
  pharmacies,
  users,
  access,
  onToggle,
  busy,
}: {
  organization: string;
  pharmacies: PortalPharmacy[];
  users: AccessUser[];
  access: Set<string>;
  onToggle: (pharmacyId: string, userId: string, allowed: boolean) => void;
  busy: Set<string>;
}) {
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle
      ? users.filter((u) => `${u.name} ${u.username ?? ""}`.toLowerCase().includes(needle))
      : users;
  }, [users, query]);

  if (pharmacies.length === 0) {
    return <p className="text-[14px] text-muted">No pharmacies in {organization} yet — add one below.</p>;
  }

  const staff = shown.filter((u) => !u.isAdmin);
  const admins = shown.filter((u) => u.isAdmin);

  function toggleAll(pharmacyId: string) {
    const everyone = staff.every((u) => access.has(`${pharmacyId}:${u.id}`));
    for (const user of staff) {
      if (access.has(`${pharmacyId}:${user.id}`) === everyone) onToggle(pharmacyId, user.id, !everyone);
    }
  }

  return (
    <div className="space-y-3">
      {users.length > 8 && (
        <div className="relative max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a person"
            aria-label="Find a person"
            className="pl-9"
          />
        </div>
      )}
      <div className="scroll-slim overflow-x-auto rounded-ledger border border-line bg-raised">
        <table className="w-full text-[14px]">
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="label-mono sticky left-0 z-10 bg-raised px-4 py-3 text-left font-normal text-muted">
                Staff
              </th>
              {pharmacies.map((pharmacy) => (
                <th key={pharmacy.id} scope="col" className="px-3 py-3 text-center align-bottom font-normal">
                  <span className="block min-w-[6.5rem] text-[13px] leading-tight text-ink">{pharmacy.name}</span>
                  {staff.length > 0 && (
                    <button
                      onClick={() => toggleAll(pharmacy.id)}
                      className="label-mono mt-1.5 text-[10px] text-muted hover:text-accent-soft"
                    >
                      {staff.every((u) => access.has(`${pharmacy.id}:${u.id}`)) ? "Clear all" : "Select all"}
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {staff.map((user) => (
              <tr key={user.id} className="transition-colors hover:bg-sunken">
                <th scope="row" className="sticky left-0 z-10 bg-raised px-4 py-2.5 text-left font-normal">
                  <span className="block text-ink">{user.name}</span>
                  <span className="label-mono block text-muted">
                    {user.username ?? "no username"}
                    {!user.appActive && " · deactivated"}
                  </span>
                </th>
                {pharmacies.map((pharmacy) => {
                  const key = `${pharmacy.id}:${user.id}`;
                  const checked = access.has(key);
                  const pending = busy.has(key);
                  return (
                    <td key={pharmacy.id} className="px-3 py-2.5 text-center">
                      <button
                        role="checkbox"
                        aria-checked={checked}
                        aria-label={`${user.name} can see ${pharmacy.name}`}
                        disabled={pending}
                        onClick={() => onToggle(pharmacy.id, user.id, !checked)}
                        className={cn(
                          "inline-grid h-6 w-6 place-items-center rounded-btn border transition-all duration-150",
                          checked
                            ? "border-accent bg-accent text-white"
                            : "border-line bg-sunken text-transparent hover:border-accent",
                        )}
                      >
                        {pending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
                        ) : (
                          <Check className="h-3.5 w-3.5" strokeWidth={3} />
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
            {admins.map((user) => (
              <tr key={user.id}>
                <th scope="row" className="sticky left-0 z-10 bg-raised px-4 py-2.5 text-left font-normal">
                  <span className="block text-ink">{user.name}</span>
                  <span className="label-mono block text-muted">{user.username ?? "no username"}</span>
                </th>
                <td colSpan={pharmacies.length} className="px-3 py-2.5 text-center">
                  <span className="label-mono inline-flex items-center gap-1.5 text-muted">
                    <ShieldCheck className="h-3.5 w-3.5 text-accent-soft" aria-hidden="true" />
                    Administrator — sees every pharmacy
                  </span>
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={pharmacies.length + 1} className="px-4 py-6 text-center text-muted">
                  {query ? "No one matches that search." : `No active people in ${organization}.`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PharmacyRow({
  pharmacy,
  tenants,
  onMessage,
}: {
  pharmacy: PortalPharmacy;
  tenants: Tenant[];
  onMessage: (ok: boolean, message: string) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(pharmacy.name);
  const [tenantId, setTenantId] = useState(pharmacy.pharma_tenant_id ?? "");
  const [pending, startTransition] = useTransition();
  const dirty = name.trim() !== pharmacy.name || (tenantId || null) !== pharmacy.pharma_tenant_id;

  function save() {
    startTransition(async () => {
      const result = await savePharmacy({
        id: pharmacy.id,
        organization: pharmacy.organization,
        name,
        tenantId: tenantId || null,
      });
      onMessage(result.ok, result.message);
      if (result.ok) router.refresh();
    });
  }

  function remove() {
    if (
      !window.confirm(
        `Remove ${pharmacy.name}? Its notices, policies, formulary and access list are deleted too. Chats in the Pharma Portal are not affected.`,
      )
    )
      return;
    startTransition(async () => {
      const result = await deletePharmacy({ id: pharmacy.id });
      onMessage(result.ok, result.message);
      if (result.ok) router.refresh();
    });
  }

  return (
    <li className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
      <div className="space-y-1.5">
        <Label htmlFor={`name-${pharmacy.id}`}>Name</Label>
        <Input id={`name-${pharmacy.id}`} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`tenant-${pharmacy.id}`}>Chat connects to</Label>
        <select
          id={`tenant-${pharmacy.id}`}
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
          className={SELECT}
        >
          <option value="">Not connected</option>
          {tenants.map((tenant) => (
            <option key={tenant.id} value={tenant.id}>
              {tenant.name}
            </option>
          ))}
          {tenantId && !tenants.some((t) => t.id === tenantId) && (
            <option value={tenantId}>Linked Pharma Portal account</option>
          )}
        </select>
      </div>
      <div className="flex gap-2">
        <Button onClick={save} disabled={pending || !dirty || !name.trim()}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Check className="h-3.5 w-3.5" aria-hidden="true" />}
          Save
        </Button>
        <Button variant="ghost" onClick={remove} disabled={pending} aria-label={`Remove ${pharmacy.name}`}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </li>
  );
}

function AddPharmacy({
  organization,
  tenants,
  onMessage,
}: {
  organization: string;
  tenants: Tenant[];
  onMessage: (ok: boolean, message: string) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [pending, startTransition] = useTransition();

  function add() {
    startTransition(async () => {
      const result = await savePharmacy({ organization, name, tenantId: tenantId || null });
      onMessage(result.ok, result.message);
      if (result.ok) {
        setName("");
        setTenantId("");
        router.refresh();
      }
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        add();
      }}
      className="grid gap-3 border-t border-line bg-sunken px-5 py-4 md:grid-cols-[1fr_1fr_auto] md:items-end"
    >
      <div className="space-y-1.5">
        <Label htmlFor={`new-${organization}`}>Add a pharmacy</Label>
        <Input
          id={`new-${organization}`}
          value={name}
          maxLength={80}
          placeholder="e.g. Downey Pharmacy"
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`new-tenant-${organization}`}>Chat connects to</Label>
        <select
          id={`new-tenant-${organization}`}
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
          className={SELECT}
        >
          <option value="">Not connected</option>
          {tenants.map((tenant) => (
            <option key={tenant.id} value={tenant.id}>
              {tenant.name}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" disabled={pending || !name.trim()}>
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Plus className="h-3.5 w-3.5" aria-hidden="true" />}
        Add
      </Button>
    </form>
  );
}

export function PharmacyAccessAdmin({
  pharmacies,
  users,
  access: initialAccess,
  organizations,
  tenants,
  isSuperAdmin,
}: {
  pharmacies: PortalPharmacy[];
  users: AccessUser[];
  access: string[];
  organizations: string[];
  tenants: Tenant[];
  isSuperAdmin: boolean;
}) {
  const [access, setAccess] = useState(() => new Set(initialAccess));
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  // Keep local state in step with fresh server data after a refresh.
  const serverKey = initialAccess.slice().sort().join("|");
  const [seenKey, setSeenKey] = useState(serverKey);
  if (seenKey !== serverKey) {
    setSeenKey(serverKey);
    setAccess(new Set(initialAccess));
  }

  const orgs = useMemo(() => {
    const names = new Set<string>(organizations);
    for (const pharmacy of pharmacies) names.add(pharmacy.organization);
    return Array.from(names).sort();
  }, [organizations, pharmacies]);

  async function toggle(pharmacyId: string, userId: string, allowed: boolean) {
    const key = `${pharmacyId}:${userId}`;
    setBusy((b) => new Set(b).add(key));
    setAccess((a) => {
      const next = new Set(a);
      if (allowed) next.add(key);
      else next.delete(key);
      return next;
    });
    const result = await setPharmacyAccess({ pharmacyId, userId, allowed });
    setBusy((b) => {
      const next = new Set(b);
      next.delete(key);
      return next;
    });
    if (!result.ok) {
      setAccess((a) => {
        const next = new Set(a);
        if (allowed) next.delete(key);
        else next.add(key);
        return next;
      });
      setMessage({ ok: false, text: result.message });
    }
  }

  const note = (ok: boolean, text: string) => setMessage({ ok, text });

  return (
    <div className="space-y-10">
      {message && (
        <p
          role="status"
          className={cn(
            "rounded-btn border border-line bg-raised px-4 py-2.5 text-[13px]",
            message.ok ? "text-ok" : "text-warn",
          )}
        >
          {message.text}
        </p>
      )}

      {orgs.map((organization) => {
        const orgPharmacies = pharmacies.filter((p) => p.organization === organization);
        const orgUsers = users.filter((u) => u.organization === organization);
        return (
          <Fragment key={organization}>
            <section className="space-y-4">
              <div>
                <h2 className="font-serif text-2xl text-ink">Who can see which pharmacy</h2>
                {isSuperAdmin && <p className="label-mono mt-1 text-accent-soft">{organization}</p>}
              </div>
              <AccessMatrix
                organization={organization}
                pharmacies={orgPharmacies}
                users={orgUsers}
                access={access}
                onToggle={toggle}
                busy={busy}
              />
              <p className="text-[13px] text-muted">Changes save as you click.</p>
            </section>

            <section className="space-y-4">
              <h2 className="flex items-center gap-2 font-serif text-xl text-ink">
                <Building2 className="h-5 w-5 text-accent-soft" aria-hidden="true" />
                Manage pharmacies
              </h2>
              <div className="overflow-hidden rounded-ledger border border-line bg-raised">
                {orgPharmacies.length > 0 && (
                  <ul className="divide-y divide-line">
                    {orgPharmacies.map((pharmacy) => (
                      <PharmacyRow key={pharmacy.id} pharmacy={pharmacy} tenants={tenants} onMessage={note} />
                    ))}
                  </ul>
                )}
                <AddPharmacy organization={organization} tenants={tenants} onMessage={note} />
              </div>
              {tenants.length === 0 && (
                <p className="text-[13px] text-muted">
                  Pharma Portal accounts couldn’t be listed, so chat links can’t be changed right now.
                </p>
              )}
            </section>
          </Fragment>
        );
      })}
    </div>
  );
}
