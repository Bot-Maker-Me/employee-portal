import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  organization: string | null;
  pharmacy_id: string | null;
  home_id: string | null;
};

/**
 * Loads the current user's profile. Fails closed: any error (missing table,
 * RLS denial, network) returns null so callers render the "not linked"
 * state instead of leaking data.
 */
export async function getProfile(userId: string): Promise<Profile | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, organization, pharmacy_id, home_id")
      .eq("id", userId)
      .maybeSingle();

    if (error) return null;
    return (data as Profile | null) ?? null;
  } catch {
    return null;
  }
}

/** True when the profile is usable (exists and is attached to an organization). */
export function isProfileLinked(
  profile: Profile | null,
): profile is Profile & { organization: string } {
  return Boolean(profile && profile.organization);
}
