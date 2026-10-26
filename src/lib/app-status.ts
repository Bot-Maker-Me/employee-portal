import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Per-app account state (`public.app_user_status`).
 *
 * The shared Supabase project is used by three apps, so "this person can no
 * longer sign in" must be per app. A MISSING ROW MEANS ACTIVE — a user of a
 * sibling app is never affected by a change here.
 *
 * Server-only: the table has RLS with an admin-read policy and no write policy,
 * so every read/write below goes through the service role key on the server.
 */
export const APP_KEY = "employee_portal";

export type AuthAuditAction =
  | "password_changed"
  | "admin_reset"
  | "user_created"
  | "user_deactivated"
  | "user_reactivated"
  | "username_set"
  | "login_blocked";

/**
 * Fail-closed reader: a missing row is ACTIVE, but a query error throws so the
 * caller can decide (login treats an error as "not active").
 */
export async function isUserActive(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("app_user_status")
    .select("is_active")
    .eq("user_id", userId)
    .eq("app_key", APP_KEY)
    .maybeSingle();

  if (error) throw new Error("APP_STATUS_UNAVAILABLE");
  if (!data) return true; // no row ⇒ ACTIVE
  return Boolean(data.is_active);
}

/** Keeps request URLs short when a list has hundreds of ids. */
const ID_CHUNK = 150;

function chunk(values: string[], size = ID_CHUNK): string[][] {
  const chunks: string[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

/** Status for many users at once (used by the admin user list). */
export async function getAppStatusMap(
  userIds: string[],
): Promise<Map<string, boolean>> {
  const result = new Map<string, boolean>();
  if (userIds.length === 0) return result;

  const admin = createAdminClient();
  const responses = await Promise.all(
    chunk(userIds).map((ids) =>
      admin
        .from("app_user_status")
        .select("user_id, is_active")
        .eq("app_key", APP_KEY)
        .in("user_id", ids),
    ),
  );

  for (const { data, error } of responses) {
    if (error) throw new Error("APP_STATUS_UNAVAILABLE");
    for (const row of data ?? []) {
      result.set(String(row.user_id), Boolean(row.is_active));
    }
  }
  return result;
}

/**
 * Activates or deactivates an account FOR THIS APP ONLY. Writes an upsert so
 * reactivating a user also records who did it and when.
 */
export async function setUserActive(options: {
  userId: string;
  isActive: boolean;
  updatedBy: string;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("app_user_status").upsert(
    {
      user_id: options.userId,
      app_key: APP_KEY,
      is_active: options.isActive,
      updated_by: options.updatedBy,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,app_key" },
  );

  if (error) throw new Error("APP_STATUS_WRITE_FAILED");
}

/**
 * Appends to `public.auth_audit_log`. Actions only — never a password, a
 * temporary password, a token or an email address.
 */
export async function logAuthEvent(options: {
  action: AuthAuditAction;
  actorId?: string | null;
  targetUserId?: string | null;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("auth_audit_log").insert({
      action: options.action,
      actor_id: options.actorId ?? null,
      target_user_id: options.targetUserId ?? null,
      app_key: APP_KEY,
    });
    if (error) {
      console.warn(`[auth-audit] write failed (${error.code ?? "unknown"})`);
    }
  } catch {
    // Auditing must never break the feature it records.
    console.warn("[auth-audit] writer unavailable");
  }
}
