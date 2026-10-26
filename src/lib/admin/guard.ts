import { getSessionUserId } from "@/lib/auth/session";
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
    // Middleware already validated the session for this request, so no extra
    // Supabase Auth round trip is needed here.
    const userId = await getSessionUserId();
    if (!userId) return null;

    const profile = await getProfile(userId);
    if (!isAdmin(profile) || !profile) return null;

    return {
      userId,
      profile,
      isSuperAdmin: isSuperAdmin(profile),
    };
  } catch {
    return null;
  }
}
