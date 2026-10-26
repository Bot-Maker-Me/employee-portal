import { createClient } from "@/lib/supabase/server";
import { getProfile, isAdmin, isSuperAdmin, type Profile } from "@/lib/profile";

/**
 * Server-side authorization for every admin action and admin read.
 *
 * The caller's role is read from the database (the caller's own profile row),
 * never trusted from the browser. The admin UI hides things for convenience
 * only — this is the gate.
 */
export type AdminContext = {
  userId: string;
  profile: Profile;
  isSuperAdmin: boolean;
};

export async function getAdminContext(): Promise<AdminContext | null> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const profile = await getProfile(user.id);
    if (!isAdmin(profile) || !profile) return null;

    return {
      userId: user.id,
      profile,
      isSuperAdmin: isSuperAdmin(profile),
    };
  } catch {
    return null;
  }
}
