"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAdminContext } from "@/lib/admin/guard";
import { enforceRateLimit } from "@/lib/rate-limit";
import { uuidSchema } from "@/lib/validation";
import { RECORD_CONFIGS, type RecordEntity } from "@/lib/sites/records";

/**
 * Admin writes for pharmacy sections, reference data and pharmacy access.
 *
 * Each action re-checks that the caller is an admin (`getAdminContext`) and
 * then writes with the caller's OWN session, so RLS (`can_manage_org`,
 * `can_manage_pharmacy`) is the final gate — an org admin can't touch another
 * organization's rows even with a forged id.
 */
export type SiteResult = { ok: true; message: string } | { ok: false; message: string };

const FORBIDDEN: SiteResult = { ok: false, message: "You don’t have permission to do that." };
const FAILED: SiteResult = { ok: false, message: "That didn’t save. Please try again." };
const RATE: SiteResult = { ok: false, message: "Too many changes at once — wait a minute and try again." };

async function guard(bucket: string, userLimit = 120) {
  const ctx = await getAdminContext();
  if (!ctx) return null;
  const limit = await enforceRateLimit({ bucket, userLimit, windowSeconds: 60 });
  if (!limit.ok) return "rate" as const;
  return ctx;
}

function revalidateSites() {
  revalidatePath("/", "layout");
}

const entitySchema = z.enum(["drug_database", "intervention_codes", "pharmacy_formulary"]);

/** Validates and trims a record's values against its column config. */
function cleanValues(
  entity: RecordEntity,
  values: Record<string, unknown>,
): Record<string, string> | null {
  const config = RECORD_CONFIGS[entity];
  const out: Record<string, string> = {};
  for (const field of config.fields) {
    const raw = values?.[field.key];
    const value = typeof raw === "string" ? raw.trim() : raw == null ? "" : String(raw).trim();
    if (value.length > field.max) return null;
    if (field.required && !value) return null;
    out[field.key] = value;
  }
  return out;
}

function scopeColumns(
  entity: RecordEntity,
  scope: { organization?: string | null; pharmacyId?: string | null },
): Record<string, string> | null {
  if (RECORD_CONFIGS[entity].scope === "org") {
    const organization = String(scope.organization ?? "").trim();
    return organization ? { organization } : null;
  }
  const parsed = uuidSchema.safeParse(scope.pharmacyId);
  return parsed.success ? { pharmacy_id: parsed.data } : null;
}

export async function saveRecord(input: {
  entity: RecordEntity;
  id?: string | null;
  organization?: string | null;
  pharmacyId?: string | null;
  values: Record<string, string>;
}): Promise<SiteResult> {
  const ctx = await guard("site_record_save");
  if (ctx === "rate") return RATE;
  if (!ctx) return FORBIDDEN;

  const entity = entitySchema.safeParse(input?.entity);
  if (!entity.success) return FAILED;
  const values = cleanValues(entity.data, input.values);
  if (!values) return { ok: false, message: "Fill in the required fields (and keep them short)." };

  const supabase = await createClient();
  const now = new Date().toISOString();

  if (input.id) {
    const id = uuidSchema.safeParse(input.id);
    if (!id.success) return FAILED;
    const { data, error } = await supabase
      .from(entity.data)
      .update({ ...values, updated_at: now })
      .eq("id", id.data)
      .select("id");
    if (error || !data?.length) return FORBIDDEN;
  } else {
    const scope = scopeColumns(entity.data, input);
    if (!scope) return FAILED;
    const row: Record<string, string> = { ...values, ...scope };
    const { error } = await supabase.from(entity.data).insert(row as never);
    if (error) return error.code === "42501" ? FORBIDDEN : FAILED;
  }

  revalidateSites();
  return { ok: true, message: "Saved." };
}

export async function deleteRecord(input: {
  entity: RecordEntity;
  id: string;
}): Promise<SiteResult> {
  const ctx = await guard("site_record_delete");
  if (ctx === "rate") return RATE;
  if (!ctx) return FORBIDDEN;

  const entity = entitySchema.safeParse(input?.entity);
  const id = uuidSchema.safeParse(input?.id);
  if (!entity.success || !id.success) return FAILED;

  const supabase = await createClient();
  const { data, error } = await supabase.from(entity.data).delete().eq("id", id.data).select("id");
  if (error || !data?.length) return FORBIDDEN;

  revalidateSites();
  return { ok: true, message: "Deleted." };
}

/** Bulk import of pasted rows (columns in the config's field order). */
export async function importRecords(input: {
  entity: RecordEntity;
  organization?: string | null;
  pharmacyId?: string | null;
  rows: string[][];
  replace?: boolean;
}): Promise<SiteResult> {
  const ctx = await guard("site_record_import", 10);
  if (ctx === "rate") return RATE;
  if (!ctx) return FORBIDDEN;

  const entity = entitySchema.safeParse(input?.entity);
  if (!entity.success) return FAILED;
  const config = RECORD_CONFIGS[entity.data];
  const scope = scopeColumns(entity.data, input);
  if (!scope) return FAILED;

  const rows = Array.isArray(input.rows) ? input.rows.slice(0, 5000) : [];
  const clean: Record<string, string>[] = [];
  let skipped = 0;
  for (const cells of rows) {
    if (!Array.isArray(cells)) {
      skipped += 1;
      continue;
    }
    const values: Record<string, string> = {};
    config.fields.forEach((field, index) => {
      values[field.key] = String(cells[index] ?? "");
    });
    const cleaned = cleanValues(entity.data, values);
    if (cleaned) clean.push({ ...cleaned, ...scope });
    else skipped += 1;
  }
  if (clean.length === 0) {
    return { ok: false, message: "No usable rows found. Check the column order." };
  }

  const supabase = await createClient();

  if (input.replace) {
    const [column, value] = Object.entries(scope)[0];
    const { error } = await supabase.from(entity.data).delete().eq(column, value);
    if (error) return FORBIDDEN;
  }

  for (let i = 0; i < clean.length; i += 500) {
    const { error } = await supabase.from(entity.data).insert(clean.slice(i, i + 500) as never);
    if (error) {
      revalidateSites();
      return {
        ok: false,
        message: error.code === "42501" ? FORBIDDEN.message : `Import stopped after ${i} rows.`,
      };
    }
  }

  revalidateSites();
  return {
    ok: true,
    message: `Imported ${clean.length} ${clean.length === 1 ? config.singular : config.plural}${
      skipped ? ` (${skipped} skipped — missing required values or too long)` : ""
    }.`,
  };
}

// ---------------------------------------------------------------------------
// Notices & reminders
// ---------------------------------------------------------------------------
const noticeSchema = z.object({
  id: uuidSchema.nullable().optional(),
  pharmacyId: uuidSchema,
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().max(8000),
  priority: z.enum(["normal", "important", "urgent"]),
  pinned: z.boolean(),
  remindOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});

export async function saveNotice(input: z.input<typeof noticeSchema>): Promise<SiteResult> {
  const ctx = await guard("site_notice_save");
  if (ctx === "rate") return RATE;
  if (!ctx) return FORBIDDEN;

  const parsed = noticeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Add a title (and keep the text under 8,000 characters)." };
  const data = parsed.data;
  const row = {
    title: data.title,
    body: data.body,
    priority: data.priority,
    pinned: data.pinned,
    remind_on: data.remindOn || null,
  };

  const supabase = await createClient();
  if (data.id) {
    const { data: updated, error } = await supabase
      .from("pharmacy_notices")
      .update({ ...row, updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("pharmacy_id", data.pharmacyId)
      .select("id");
    if (error || !updated?.length) return FORBIDDEN;
  } else {
    const { error } = await supabase
      .from("pharmacy_notices")
      .insert({ ...row, pharmacy_id: data.pharmacyId, created_by: ctx.userId });
    if (error) return error.code === "42501" ? FORBIDDEN : FAILED;
  }

  revalidateSites();
  return { ok: true, message: data.id ? "Notice updated." : "Notice posted." };
}

export async function deleteNotice(input: { id: string }): Promise<SiteResult> {
  const ctx = await guard("site_notice_delete");
  if (ctx === "rate") return RATE;
  if (!ctx) return FORBIDDEN;
  const id = uuidSchema.safeParse(input?.id);
  if (!id.success) return FAILED;

  const supabase = await createClient();
  const { data, error } = await supabase.from("pharmacy_notices").delete().eq("id", id.data).select("id");
  if (error || !data?.length) return FORBIDDEN;
  revalidateSites();
  return { ok: true, message: "Notice deleted." };
}

// ---------------------------------------------------------------------------
// Policies & procedures
// ---------------------------------------------------------------------------
const policySchema = z.object({
  id: uuidSchema.nullable().optional(),
  pharmacyId: uuidSchema,
  title: z.string().trim().min(1).max(160),
  category: z.string().trim().max(60),
  body: z.string().trim().max(50000),
  linkUrl: z
    .string()
    .trim()
    .max(2000)
    .refine((value) => value === "" || /^https?:\/\/\S+$/i.test(value))
    .optional(),
});

export async function savePolicy(input: z.input<typeof policySchema>): Promise<SiteResult> {
  const ctx = await guard("site_policy_save");
  if (ctx === "rate") return RATE;
  if (!ctx) return FORBIDDEN;

  const parsed = policySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Add a title. Links must start with http:// or https://." };
  }
  const data = parsed.data;
  const row = {
    title: data.title,
    category: data.category,
    body: data.body,
    link_url: data.linkUrl ? data.linkUrl : null,
  };

  const supabase = await createClient();
  if (data.id) {
    const { data: updated, error } = await supabase
      .from("pharmacy_policies")
      .update({ ...row, updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("pharmacy_id", data.pharmacyId)
      .select("id");
    if (error || !updated?.length) return FORBIDDEN;
  } else {
    const { error } = await supabase
      .from("pharmacy_policies")
      .insert({ ...row, pharmacy_id: data.pharmacyId, created_by: ctx.userId });
    if (error) return error.code === "42501" ? FORBIDDEN : FAILED;
  }

  revalidateSites();
  return { ok: true, message: data.id ? "Policy updated." : "Policy added." };
}

export async function deletePolicy(input: { id: string }): Promise<SiteResult> {
  const ctx = await guard("site_policy_delete");
  if (ctx === "rate") return RATE;
  if (!ctx) return FORBIDDEN;
  const id = uuidSchema.safeParse(input?.id);
  if (!id.success) return FAILED;

  const supabase = await createClient();
  const { data, error } = await supabase.from("pharmacy_policies").delete().eq("id", id.data).select("id");
  if (error || !data?.length) return FORBIDDEN;
  revalidateSites();
  return { ok: true, message: "Policy deleted." };
}

// ---------------------------------------------------------------------------
// Pharmacy access + pharmacy setup (Admin → Pharmacies)
// ---------------------------------------------------------------------------
export async function setPharmacyAccess(input: {
  pharmacyId: string;
  userId: string;
  allowed: boolean;
}): Promise<SiteResult> {
  const ctx = await guard("site_access", 300);
  if (ctx === "rate") return RATE;
  if (!ctx) return FORBIDDEN;

  const pharmacyId = uuidSchema.safeParse(input?.pharmacyId);
  const userId = uuidSchema.safeParse(input?.userId);
  if (!pharmacyId.success || !userId.success) return FAILED;

  const supabase = await createClient();
  if (input.allowed) {
    const { error } = await supabase
      .from("pharmacy_access")
      .upsert(
        { pharmacy_id: pharmacyId.data, user_id: userId.data, granted_by: ctx.userId },
        { onConflict: "pharmacy_id,user_id", ignoreDuplicates: true },
      );
    if (error) return error.code === "42501" ? FORBIDDEN : FAILED;
  } else {
    const { error } = await supabase
      .from("pharmacy_access")
      .delete()
      .eq("pharmacy_id", pharmacyId.data)
      .eq("user_id", userId.data);
    if (error) return FORBIDDEN;
  }

  revalidateSites();
  return { ok: true, message: input.allowed ? "Access granted." : "Access removed." };
}

const pharmacySchema = z.object({
  id: uuidSchema.nullable().optional(),
  organization: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(80),
  tenantId: uuidSchema.nullable().optional(),
});

function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug.length >= 2 ? slug : `pharmacy-${Date.now().toString(36)}`;
}

export async function savePharmacy(input: z.input<typeof pharmacySchema>): Promise<SiteResult> {
  const ctx = await guard("site_pharmacy_save", 30);
  if (ctx === "rate") return RATE;
  if (!ctx) return FORBIDDEN;

  const parsed = pharmacySchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Enter a pharmacy name." };
  const data = parsed.data;
  if (!ctx.isSuperAdmin && data.organization !== ctx.profile.organization) return FORBIDDEN;

  const supabase = await createClient();
  if (data.id) {
    const { data: updated, error } = await supabase
      .from("portal_pharmacies")
      .update({ name: data.name, pharma_tenant_id: data.tenantId ?? null })
      .eq("id", data.id)
      .select("id");
    if (error || !updated?.length) return FORBIDDEN;
  } else {
    const { data: last } = await supabase
      .from("portal_pharmacies")
      .select("sort_order")
      .eq("organization", data.organization)
      .order("sort_order", { ascending: false })
      .limit(1);
    const { error } = await supabase.from("portal_pharmacies").insert({
      organization: data.organization,
      name: data.name,
      slug: slugify(data.name),
      sort_order: Number(last?.[0]?.sort_order ?? 0) + 1,
      pharma_tenant_id: data.tenantId ?? null,
    });
    if (error) {
      if (error.code === "23505") return { ok: false, message: "A pharmacy with that name already exists." };
      return error.code === "42501" ? FORBIDDEN : FAILED;
    }
  }

  revalidateSites();
  return { ok: true, message: data.id ? "Pharmacy updated." : "Pharmacy added." };
}

export async function deletePharmacy(input: { id: string }): Promise<SiteResult> {
  const ctx = await guard("site_pharmacy_delete", 10);
  if (ctx === "rate") return RATE;
  if (!ctx) return FORBIDDEN;
  const id = uuidSchema.safeParse(input?.id);
  if (!id.success) return FAILED;

  const supabase = await createClient();
  const { data, error } = await supabase.from("portal_pharmacies").delete().eq("id", id.data).select("id");
  if (error || !data?.length) return FORBIDDEN;
  revalidateSites();
  return { ok: true, message: "Pharmacy removed, along with its notices, policies and formulary." };
}
