import { createPharmaClient } from "@/lib/pharma/client";

export type Pharmacy = { id: string; name: string };
export type PharmacyMember = {
  id: string;
  full_name: string | null;
  role: string | null;
};

/**
 * Pharmacies are `tenants` in the Pharma/Nursing project, and
 * `topic_threads.pharmacy_id` references `tenants.id`.
 */
export async function listPharmacies(): Promise<Pharmacy[]> {
  const supabase = createPharmaClient();
  const { data, error } = await supabase
    .from("tenants")
    .select("id, name")
    .order("name");
  if (error) return [];
  return (data ?? []) as Pharmacy[];
}

/** Members of a pharmacy come from `tenant_members` → `profiles`. */
export async function listPharmacyMembers(
  pharmacyId: string,
): Promise<PharmacyMember[]> {
  if (!pharmacyId) return [];
  const supabase = createPharmaClient();

  const { data: memberships, error } = await supabase
    .from("tenant_members")
    .select("user_id, is_active")
    .eq("tenant_id", pharmacyId);
  if (error) return [];

  const ids = (memberships ?? [])
    .filter((m) => m.is_active !== false)
    .map((m) => m.user_id as string);
  if (ids.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .in("id", ids);

  return ((profiles ?? []) as PharmacyMember[]).sort((a, b) =>
    (a.full_name ?? "").localeCompare(b.full_name ?? ""),
  );
}
