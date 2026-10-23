import { createClient } from "@/lib/supabase/server";

export type AdminUser = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  organization: string | null;
  status: string | null;
};

export type AdminOrg = { name: string; member_count: number };
export type AdminFeature = { feature_key: string; enabled: boolean };

/**
 * Admin reads go through SECURITY DEFINER RPCs that re-check the caller's role
 * server-side, so no service-role key is needed and RLS stays intact.
 */
export async function getAdminUsers(): Promise<AdminUser[]> {
  const supabase = createClient();
  const { data } = await supabase.rpc("admin_list_users");
  return (data ?? []) as AdminUser[];
}

export async function getAdminOrganizations(): Promise<AdminOrg[]> {
  const supabase = createClient();
  const { data } = await supabase.rpc("admin_list_organizations");
  return (data ?? []) as AdminOrg[];
}
