import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { isAdmin, isSuperAdmin, type Profile } from "@/lib/profile";
import {
  RECORD_CONFIGS,
  sanitizeSearch,
  type RecordEntity,
  type RecordRow,
} from "@/lib/sites/records";

/**
 * Server-only reads for the pharmacy sections and reference data. Everything
 * goes through the user's own session, so RLS decides what comes back:
 * employees only ever receive the pharmacies an admin has granted them.
 */
export type PortalPharmacy = {
  id: string;
  organization: string;
  slug: string;
  name: string;
  sort_order: number;
  pharma_tenant_id: string | null;
};

const PHARMACY_COLUMNS = "id, organization, slug, name, sort_order, pharma_tenant_id";

/** Pharmacies the signed-in user may open (RLS-filtered), in menu order. */
export const listMyPharmacies = cache(async (): Promise<PortalPharmacy[]> => {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("portal_pharmacies")
      .select(PHARMACY_COLUMNS)
      .order("organization")
      .order("sort_order")
      .order("name");
    if (error) return [];
    return (data ?? []) as PortalPharmacy[];
  } catch {
    return [];
  }
});

export const getMyPharmacy = cache(
  async (id: string): Promise<PortalPharmacy | null> => {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const list = await listMyPharmacies();
    return list.find((pharmacy) => pharmacy.id === id) ?? null;
  },
);

/**
 * Which organization's reference data to show. Everyone uses their own; a
 * platform admin without one may pick (`?org=`), defaulting to the first
 * organization that has pharmacies set up.
 */
export async function resolveWorkingOrganization(
  profile: Profile,
  requested?: string | null,
): Promise<{ organization: string | null; choices: string[] }> {
  if (profile.organization) {
    return { organization: profile.organization, choices: [profile.organization] };
  }
  if (!isSuperAdmin(profile)) return { organization: null, choices: [] };

  const supabase = createClient();
  const { data } = await supabase.from("organizations").select("name").order("name");
  const choices = (data ?? []).map((row) => String(row.name));
  if (requested && choices.includes(requested)) {
    return { organization: requested, choices };
  }
  const pharmacies = await listMyPharmacies();
  return {
    organization: pharmacies[0]?.organization ?? choices[0] ?? null,
    choices,
  };
}

/** Searchable reference rows (max 300 per view). */
export async function listRecords(options: {
  entity: RecordEntity;
  organization?: string | null;
  pharmacyId?: string | null;
  query?: string | null;
}): Promise<{ rows: RecordRow[]; total: number; truncated: boolean }> {
  const config = RECORD_CONFIGS[options.entity];
  const columns = ["id", ...config.fields.map((field) => field.key)].join(", ");
  const supabase = createClient();

  let request = supabase
    .from(config.entity)
    .select(columns, { count: "exact" })
    .order(config.orderBy)
    .limit(300);

  if (config.scope === "org") {
    if (!options.organization) return { rows: [], total: 0, truncated: false };
    request = request.eq("organization", options.organization);
  } else {
    if (!options.pharmacyId) return { rows: [], total: 0, truncated: false };
    request = request.eq("pharmacy_id", options.pharmacyId);
  }

  const needle = sanitizeSearch(options.query ?? "");
  if (needle) {
    request = request.or(
      config.fields.map((field) => `${field.key}.ilike.*${needle}*`).join(","),
    );
  }

  const { data, error, count } = await request;
  if (error) return { rows: [], total: 0, truncated: false };
  const rows = ((data ?? []) as unknown as Record<string, unknown>[]).map((row) => {
    const out: RecordRow = { id: String(row.id) };
    for (const field of config.fields) out[field.key] = String(row[field.key] ?? "");
    return out;
  });
  const total = count ?? rows.length;
  return { rows, total, truncated: total > rows.length };
}

export type Notice = {
  id: string;
  title: string;
  body: string;
  priority: "normal" | "important" | "urgent";
  pinned: boolean;
  remind_on: string | null;
  created_at: string;
  updated_at: string;
};

export async function listNotices(pharmacyId: string): Promise<Notice[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("pharmacy_notices")
    .select("id, title, body, priority, pinned, remind_on, created_at, updated_at")
    .eq("pharmacy_id", pharmacyId)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return [];
  return (data ?? []) as Notice[];
}

export type Policy = {
  id: string;
  title: string;
  category: string;
  body: string;
  link_url: string | null;
  updated_at: string;
};

export async function listPolicies(pharmacyId: string): Promise<Policy[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("pharmacy_policies")
    .select("id, title, category, body, link_url, updated_at")
    .eq("pharmacy_id", pharmacyId)
    .order("category")
    .order("title")
    .limit(500);
  if (error) return [];
  return (data ?? []) as Policy[];
}

/**
 * Which Pharma Portal tenants this user may see in Pharmacy Chat. A tenant
 * linked to a portal pharmacy is visible only to people with access to that
 * pharmacy. Tenants not linked to any portal pharmacy keep the old behaviour
 * (visible to the organization). Admins are never restricted.
 */
export type TenantGate = {
  /** Linked to a pharmacy the user can't open. */
  blocked: Set<string>;
  /** Linked to a pharmacy the user can open. */
  allowed: Set<string>;
  /** The mapping couldn't be loaded — only `allowed` tenants are shown. */
  failClosed: boolean;
};

export const getTenantGate = cache(async (profile: Profile): Promise<TenantGate> => {
  if (isAdmin(profile)) return { blocked: new Set(), allowed: new Set(), failClosed: false };

  const visible = await listMyPharmacies();
  const allowed = new Set(
    visible.map((pharmacy) => pharmacy.pharma_tenant_id).filter(Boolean) as string[],
  );

  if (!isServiceRoleConfigured() || !profile.organization) {
    return { blocked: new Set(), allowed, failClosed: true };
  }
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("portal_pharmacies")
      .select("pharma_tenant_id")
      .eq("organization", profile.organization)
      .not("pharma_tenant_id", "is", null);
    if (error) throw error;
    const blocked = new Set(
      (data ?? [])
        .map((row) => String(row.pharma_tenant_id))
        .filter((id) => !allowed.has(id)),
    );
    return { blocked, allowed, failClosed: false };
  } catch {
    return { blocked: new Set(), allowed, failClosed: true };
  }
});

export function tenantVisible(gate: TenantGate, tenantId: string): boolean {
  if (gate.failClosed) return gate.allowed.has(tenantId);
  return !gate.blocked.has(tenantId);
}
