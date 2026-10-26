import { createAdminClient } from "@/lib/supabase/admin";
import { getAppStatusMap } from "@/lib/app-status";
import { lastLoginMap } from "@/lib/auth/login-attempts";

/**
 * Service-role reads/writes of `profiles` for the username sign-in layer.
 * SERVER ONLY.
 *
 * `profiles` is shared with the sibling apps, so everything here is additive:
 * only the username column, the forced-password-change flag and rows created by
 * this app's own admin flow are ever written.
 */
export type ProfileIdentity = {
  id: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
  role: string | null;
  organization: string | null;
  status: string | null;
  must_change_password: boolean;
};

const IDENTITY_COLUMNS =
  "id, full_name, username, email, role, organization, status, must_change_password";

export async function findProfileByUsername(
  username: string,
): Promise<ProfileIdentity | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select(IDENTITY_COLUMNS)
    .eq("username", username)
    .maybeSingle();

  if (error) return null;
  return (data as ProfileIdentity | null) ?? null;
}

export async function getProfileIdentity(
  userId: string,
): Promise<ProfileIdentity | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select(IDENTITY_COLUMNS)
    .eq("id", userId)
    .maybeSingle();

  if (error) return null;
  return (data as ProfileIdentity | null) ?? null;
}

/**
 * Availability check. Usernames are stored lowercase (enforced by a CHECK) and
 * every caller normalizes first, so an exact match IS the case-insensitive
 * check — and, unlike ILIKE, it cannot treat `_` or `%` as a wildcard. The
 * unique index on lower(username) is the final guard against races.
 * `exceptUserId` lets a user keep their current username.
 */
export async function usernameTaken(
  username: string,
  exceptUserId?: string,
): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .eq("username", username)
    .limit(1);

  if (error) throw new Error("USERNAME_CHECK_UNAVAILABLE");
  const rows = data ?? [];
  return rows.some((row) => String(row.id) !== exceptUserId);
}

/**
 * Fills `profiles.username` only — email, password and role stay untouched.
 * Throws USERNAME_TAKEN when the unique index on lower(username) rejects it
 * (the authoritative check when two admins save the same name at once).
 */
export async function setProfileUsername(
  userId: string,
  username: string,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ username })
    .eq("id", userId);
  if (!error) return;
  if (error.code === "23505") throw new Error("USERNAME_TAKEN");
  throw new Error("USERNAME_WRITE_FAILED");
}

export async function setMustChangePassword(
  userId: string,
  value: boolean,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ must_change_password: value })
    .eq("id", userId);
  if (error) throw new Error("PROFILE_WRITE_FAILED");
}

/**
 * Applies the details an admin chose for a freshly created account: the profile
 * row itself comes from the shared sign-up trigger, so this only fills it in.
 * `email` is deliberately cleared when the account was created with a
 * placeholder address, so no placeholder ever shows up in another app's UI.
 */
export async function completeCreatedProfile(options: {
  userId: string;
  fullName: string;
  username: string;
  role: string;
  organization: string;
  hasPlaceholderEmail: boolean;
}): Promise<void> {
  const admin = createAdminClient();
  const patch: Record<string, unknown> = {
    full_name: options.fullName,
    username: options.username,
    role: options.role,
    organization: options.organization,
    status: "active",
    must_change_password: true,
  };
  if (options.hasPlaceholderEmail) patch.email = null;

  const { error } = await admin
    .from("profiles")
    .update(patch)
    .eq("id", options.userId);

  if (error) throw new Error("PROFILE_WRITE_FAILED");
}

export type ManagedUser = {
  id: string;
  fullName: string | null;
  username: string | null;
  role: string | null;
  organization: string | null;
  status: string | null;
  appActive: boolean;
  lastLoginAt: string | null;
};

/** The admin "User accounts" list, already scoped to what the caller may see. */
export async function listManagedUsers(options: {
  isSuperAdmin: boolean;
  organization: string | null;
}): Promise<ManagedUser[]> {
  const admin = createAdminClient();
  let query = admin
    .from("profiles")
    .select("id, full_name, username, role, organization, status")
    .order("full_name", { ascending: true, nullsFirst: false })
    .limit(1000);

  if (!options.isSuperAdmin && options.organization) {
    query = query.eq("organization", options.organization);
  }

  const { data, error } = await query;
  if (error) throw new Error("USER_LIST_UNAVAILABLE");

  const rows = data ?? [];
  const ids = rows.map((row) => String(row.id));
  const usernames = rows
    .map((row) => (row.username ? String(row.username) : ""))
    .filter(Boolean);

  const [statuses, logins] = await Promise.all([
    getAppStatusMap(ids),
    lastLoginMap(usernames),
  ]);

  return rows.map((row) => ({
    id: String(row.id),
    fullName: row.full_name ? String(row.full_name) : null,
    username: row.username ? String(row.username) : null,
    role: row.role ? String(row.role) : null,
    organization: row.organization ? String(row.organization) : null,
    status: row.status ? String(row.status) : null,
    // A missing row means ACTIVE.
    appActive: statuses.get(String(row.id)) ?? true,
    lastLoginAt: row.username ? logins.get(String(row.username)) ?? null : null,
  }));
}

/**
 * How many admins of THIS APP could still sign in if `exceptUserId` were
 * deactivated — used to block deactivating the last remaining admin.
 * Platform admins are only ever counted against other platform admins.
 */
export async function countRemainingAdmins(options: {
  exceptUserId: string;
  organization: string | null;
  targetIsSuperAdmin: boolean;
}): Promise<number> {
  const admin = createAdminClient();
  let query = admin
    .from("profiles")
    .select("id, role, status")
    .eq("status", "active")
    .neq("id", options.exceptUserId)
    .limit(500);

  query = options.targetIsSuperAdmin
    ? query.eq("role", "super_admin")
    : query.in("role", ["admin", "super_admin"]);

  if (!options.targetIsSuperAdmin && options.organization) {
    query = query.eq("organization", options.organization);
  }

  const { data, error } = await query;
  if (error) throw new Error("ADMIN_COUNT_UNAVAILABLE");

  const rows = data ?? [];
  const statuses = await getAppStatusMap(rows.map((row) => String(row.id)));
  return rows.filter((row) => statuses.get(String(row.id)) ?? true).length;
}
