import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
  role: string | null;
  organization: string | null;
  status: string | null;
  pharmacy_id: string | null;
  home_id: string | null;
  must_change_password: boolean;
};

/**
 * Loads the current user's profile. Fails closed: any error (missing table,
 * RLS denial, network) returns null so callers render the "not linked" state
 * instead of leaking data.
 *
 * Wrapped in React's `cache` so the layout and the page it wraps share ONE
 * query per request instead of running the same lookup twice. Outside a render
 * (route handlers) it simply runs normally.
 */
export const getProfile = cache(
  async (userId: string): Promise<Profile | null> => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, full_name, username, email, role, organization, status, pharmacy_id, home_id, must_change_password",
        )
        .eq("id", userId)
        .maybeSingle();

      if (error) return null;
      return (data as Profile | null) ?? null;
    } catch {
      return null;
    }
  },
);

/** Approved accounts are the only ones allowed into the portal. */
export function isApproved(profile: Profile | null): boolean {
  return profile?.status === "active";
}

/** Organization admins and the platform super-admin. */
export function isAdmin(profile: Profile | null): boolean {
  return profile?.role === "admin" || profile?.role === "super_admin";
}

/** The platform owner: manages every organization and feature. */
export function isSuperAdmin(profile: Profile | null): boolean {
  return profile?.role === "super_admin";
}
