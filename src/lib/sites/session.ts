import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth/session";
import { getProfile, type Profile } from "@/lib/profile";

/** Signed-in, profile-backed user for portal pages (the layout already gates status). */
export async function requirePortalUser(): Promise<{ userId: string; profile: Profile }> {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  const profile = await getProfile(userId);
  if (!profile) redirect("/login");
  return { userId, profile };
}
