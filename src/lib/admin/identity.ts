import { createAdminClient } from "@/lib/supabase/admin";
import { listManagedUsers, type ManagedUser } from "@/lib/auth/store";
import type { AdminContext } from "@/lib/admin/guard";

/**
 * Admin reads for the username layer. All of it is server-side and scoped:
 * an organization admin only ever sees their own organization, a platform
 * administrator sees everything. Fail closed: any error returns an empty list
 * so no row is shown that the caller should not have.
 */
export type ResetRequestRow = {
  id: string;
  userId: string | null;
  username: string;
  fullName: string | null;
  organization: string | null;
  requestedAt: string;
};

export async function listPendingResetRequests(
  ctx: AdminContext,
): Promise<ResetRequestRow[]> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("password_reset_requests")
      .select("id, user_id, username, requested_at")
      .eq("status", "pending")
      .order("requested_at", { ascending: true })
      .limit(200);

    if (error) return [];

    const rows = data ?? [];
    const ids = rows
      .map((row) => (row.user_id ? String(row.user_id) : ""))
      .filter(Boolean);

    const byId = new Map<string, { fullName: string | null; organization: string | null }>();
    if (ids.length > 0) {
      const { data: profiles } = await admin
        .from("profiles")
        .select("id, full_name, organization")
        .in("id", ids);
      for (const profile of profiles ?? []) {
        byId.set(String(profile.id), {
          fullName: profile.full_name ? String(profile.full_name) : null,
          organization: profile.organization ? String(profile.organization) : null,
        });
      }
    }

    return rows
      .map((row) => {
        const userId = row.user_id ? String(row.user_id) : null;
        const profile = userId ? byId.get(userId) : undefined;
        return {
          id: String(row.id),
          userId,
          username: String(row.username),
          fullName: profile?.fullName ?? null,
          organization: profile?.organization ?? null,
          requestedAt: String(row.requested_at),
        };
      })
      .filter((row) =>
        ctx.isSuperAdmin
          ? true
          : Boolean(
              row.organization &&
                row.organization === ctx.profile.organization,
            ),
      );
  } catch {
    return [];
  }
}

export async function listUsersForAdmin(
  ctx: AdminContext,
): Promise<ManagedUser[]> {
  try {
    return await listManagedUsers({
      isSuperAdmin: ctx.isSuperAdmin,
      organization: ctx.profile.organization,
    });
  } catch {
    return [];
  }
}
