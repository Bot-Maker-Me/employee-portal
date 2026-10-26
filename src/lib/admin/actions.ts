"use server";

import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { enforceRateLimit } from "@/lib/rate-limit";
import { logAuthEvent, setUserActive } from "@/lib/app-status";
import {
  SERVICE_UNAVAILABLE_ERROR,
  TOO_MANY_ATTEMPTS_ERROR,
  USERNAME_HINT,
  isValidUsername,
  normalizeUsername,
} from "@/lib/auth/username";
import {
  completeCreatedProfile,
  countRemainingAdmins,
  getProfileIdentity,
  setMustChangePassword,
  setProfileUsername,
  usernameTaken,
  type ProfileIdentity,
} from "@/lib/auth/store";
import { generateTemporaryPassword, randomLocalPart } from "@/lib/auth/temp-password";
import { getAdminContext, type AdminContext } from "@/lib/admin/guard";

/**
 * Admin account management. Every action re-reads the caller's role from the
 * database (never from the UI), is scoped to the caller's own organization
 * unless they are a platform administrator, and uses the service role key on
 * the server only. Temporary passwords are returned once and never stored.
 */
export type AdminResult =
  | { ok: true; message: string; tempPassword?: string }
  | { ok: false; message: string };

const GENERIC_FAILURE = "Something went wrong. Please try again.";
const FORBIDDEN = "You don’t have permission to do that.";

function isAdminRole(role: string | null): boolean {
  return role === "admin" || role === "super_admin";
}

/** The database still enforces the old charset — migration 0004 not applied. */
const USERNAME_CHARSET_ERROR =
  "That username uses characters the database doesn’t accept yet. Apply supabase/migrations/0004_username_charset.sql, then set it again.";

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message === "USERNAME_TAKEN") {
    return "That username is already taken.";
  }
  if (error instanceof Error && error.message === "USERNAME_CHARSET_REJECTED") {
    return USERNAME_CHARSET_ERROR;
  }
  return fallback;
}

/** Loads a target the caller is allowed to manage, or null. */
async function loadManageableTarget(
  ctx: AdminContext,
  userId: string,
): Promise<ProfileIdentity | null> {
  const target = await getProfileIdentity(userId);
  if (!target) return null;
  if (ctx.isSuperAdmin) return target;
  if (target.role === "super_admin") return null;
  if (!ctx.profile.organization) return null;
  if (target.organization !== ctx.profile.organization) return null;
  return target;
}

/** Live availability check for the create / set-username forms. */
export async function adminCheckUsername(input: {
  username: string;
}): Promise<{ available: boolean; message: string }> {
  const ctx = await getAdminContext();
  if (!ctx) return { available: false, message: FORBIDDEN };

  const username = normalizeUsername(String(input?.username ?? ""));
  if (!isValidUsername(username)) {
    return { available: false, message: USERNAME_HINT };
  }

  try {
    const taken = await usernameTaken(username);
    return taken
      ? { available: false, message: "That username is already taken." }
      : { available: true, message: "That username is available." };
  } catch {
    return { available: false, message: "We couldn’t check that username." };
  }
}

export async function adminCreateUser(input: {
  fullName: string;
  username: string;
  role: string;
  organization: string;
}): Promise<AdminResult> {
  const ctx = await getAdminContext();
  if (!ctx) return { ok: false, message: FORBIDDEN };
  if (!isServiceRoleConfigured()) return { ok: false, message: SERVICE_UNAVAILABLE_ERROR };

  const limit = await enforceRateLimit({
    bucket: "admin_create_user",
    userLimit: 10,
    windowSeconds: 900,
    ipLimit: 40,
  });
  if (!limit.ok) return { ok: false, message: TOO_MANY_ATTEMPTS_ERROR };

  const fullName = String(input?.fullName ?? "").trim();
  const username = normalizeUsername(String(input?.username ?? ""));
  const role = String(input?.role ?? "employee");
  const requestedOrg = String(input?.organization ?? "").trim();
  const organization = ctx.isSuperAdmin
    ? requestedOrg
    : (ctx.profile.organization ?? "");

  if (fullName.length < 1 || fullName.length > 120) {
    return { ok: false, message: "Enter the person’s full name." };
  }
  if (!isValidUsername(username)) {
    return { ok: false, message: `That username isn’t valid. ${USERNAME_HINT}` };
  }
  if (role !== "employee" && role !== "admin") {
    return { ok: false, message: "That role isn’t allowed." };
  }
  if (!organization) return { ok: false, message: "Pick an organization first." };
  if (!ctx.isSuperAdmin && requestedOrg && requestedOrg !== organization) {
    return { ok: false, message: FORBIDDEN };
  }

  // The hidden address used for the auth account. Nothing is ever sent to it.
  const domain = (process.env.PLACEHOLDER_EMAIL_DOMAIN ?? "").trim();
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain) || /\s/.test(domain)) {
    console.error("[admin] PLACEHOLDER_EMAIL_DOMAIN is not configured");
    return {
      ok: false,
      message:
        "Creating accounts is not configured on this server (PLACEHOLDER_EMAIL_DOMAIN).",
    };
  }

  const admin = createAdminClient();

  try {
    if (await usernameTaken(username)) {
      return { ok: false, message: "That username is already taken." };
    }
  } catch {
    return { ok: false, message: GENERIC_FAILURE };
  }

  const { data: org } = await admin
    .from("organizations")
    .select("name")
    .eq("name", organization)
    .maybeSingle();
  if (!org) {
    return { ok: false, message: "That organization doesn’t exist yet." };
  }

  const tempPassword = generateTemporaryPassword();
  const email = `${randomLocalPart()}@${domain}`;

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  const createdId = created?.user?.id ? String(created.user.id) : null;
  if (error || !createdId) {
    // Status/code only — never the address, the password or a token.
    console.warn(`[admin] user creation failed (${error?.status ?? "unknown"})`);
    return { ok: false, message: "We couldn’t create that account. Please try again." };
  }

  try {
    await completeCreatedProfile({
      userId: createdId,
      fullName,
      username,
      role,
      organization,
      hasPlaceholderEmail: true,
    });
  } catch (error) {
    return {
      ok: false,
      message: errorMessage(
        error,
        "The sign-in account was created, but its profile could not be set up. Ask a platform administrator to finish it.",
      ),
    };
  }

  await logAuthEvent({
    action: "user_created",
    actorId: ctx.userId,
    targetUserId: createdId,
  });

  return { ok: true, message: `Account created for ${username}.`, tempPassword };
}

export type BulkCreatedUser = { username: string; tempPassword: string };
export type BulkCreateResult =
  | { ok: true; message: string; created: BulkCreatedUser[]; failed: number }
  | { ok: false; message: string };

/**
 * Creates several accounts at once (test/demo batches, onboarding a team).
 * Usernames are `<prefix><number>`, each account gets its own hidden placeholder
 * address and its own temporary password, and everyone is forced to choose a
 * password at first sign-in. Runs through the Supabase Auth Admin API, so every
 * account is guaranteed to be able to sign in.
 */
export async function adminBulkCreateUsers(input: {
  count: number;
  prefix: string;
  startAt: number;
  role: string;
  organization: string;
}): Promise<BulkCreateResult> {
  const ctx = await getAdminContext();
  if (!ctx) return { ok: false, message: FORBIDDEN };
  if (!isServiceRoleConfigured()) return { ok: false, message: SERVICE_UNAVAILABLE_ERROR };

  const limit = await enforceRateLimit({
    bucket: "admin_bulk_create",
    userLimit: 5,
    windowSeconds: 900,
    ipLimit: 20,
  });
  if (!limit.ok) return { ok: false, message: TOO_MANY_ATTEMPTS_ERROR };

  const count = Math.min(Math.max(Math.floor(Number(input?.count) || 0), 1), 50);
  const prefix = normalizeUsername(String(input?.prefix ?? "staff"));
  const startAt = Math.min(Math.max(Math.floor(Number(input?.startAt) || 1), 1), 99999);
  const role = String(input?.role ?? "employee");
  const requestedOrg = String(input?.organization ?? "").trim();
  const organization = ctx.isSuperAdmin
    ? requestedOrg
    : (ctx.profile.organization ?? "");

  if (!isValidUsername(`${prefix}${"1".padStart(3, "0")}`)) {
    return {
      ok: false,
      message: `That prefix can’t make valid usernames (${USERNAME_HINT}).`,
    };
  }
  if (role !== "employee" && role !== "admin") {
    return { ok: false, message: "That role isn’t allowed." };
  }
  if (!organization) return { ok: false, message: "Pick an organization first." };

  const domain = (process.env.PLACEHOLDER_EMAIL_DOMAIN ?? "").trim();
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain) || /\s/.test(domain)) {
    console.error("[admin] PLACEHOLDER_EMAIL_DOMAIN is not configured");
    return {
      ok: false,
      message:
        "Creating accounts is not configured on this server (PLACEHOLDER_EMAIL_DOMAIN).",
    };
  }

  const admin = createAdminClient();

  const { data: org } = await admin
    .from("organizations")
    .select("name")
    .eq("name", organization)
    .maybeSingle();
  if (!org) return { ok: false, message: "That organization doesn’t exist yet." };

  // One index range scan instead of a query per candidate. The upper bound is a
  // high code point, so no LIKE metacharacter (the prefix may contain . _ -).
  const { data: existing, error: existingError } = await admin
    .from("profiles")
    .select("username")
    .gte("username", prefix)
    .lt("username", `${prefix}\uffff`)
    .limit(1000);

  if (existingError) return { ok: false, message: GENERIC_FAILURE };

  const taken = new Set(
    (existing ?? [])
      .map((row) => (row.username ? String(row.username).toLowerCase() : ""))
      .filter(Boolean),
  );

  const usernames: string[] = [];
  let index = startAt;
  while (usernames.length < count && index < startAt + count + 500) {
    const candidate = `${prefix}${String(index).padStart(3, "0")}`;
    index += 1;
    if (!isValidUsername(candidate) || taken.has(candidate)) continue;
    taken.add(candidate);
    usernames.push(candidate);
  }

  if (usernames.length === 0) {
    return { ok: false, message: "No free usernames with that prefix and start." };
  }

  const created: BulkCreatedUser[] = [];
  const createdIds: string[] = [];
  let failed = 0;

  for (const username of usernames) {
    const tempPassword = generateTemporaryPassword();
    const { data: account, error } = await admin.auth.admin.createUser({
      email: `${randomLocalPart()}@${domain}`,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: username },
    });

    const newId = account?.user?.id ? String(account.user.id) : null;
    if (error || !newId) {
      failed += 1;
      console.warn(`[admin] bulk creation failed (${error?.status ?? "unknown"})`);
      continue;
    }

    try {
      await completeCreatedProfile({
        userId: newId,
        fullName: username,
        username,
        role,
        organization,
        hasPlaceholderEmail: true,
      });
    } catch {
      failed += 1;
      continue;
    }

    created.push({ username, tempPassword });
    createdIds.push(newId);
  }

  await Promise.all(
    createdIds.map((targetUserId) =>
      logAuthEvent({ action: "user_created", actorId: ctx.userId, targetUserId }),
    ),
  );

  return {
    ok: true,
    message: `${created.length} account${created.length === 1 ? "" : "s"} created${
      failed > 0 ? ` (${failed} failed)` : ""
    }. Each one must set a new password at first sign-in.`,
    created,
    failed,
  };
}

export async function adminSetUsername(input: {
  userId: string;
  username: string;
}): Promise<AdminResult> {
  const ctx = await getAdminContext();
  if (!ctx) return { ok: false, message: FORBIDDEN };
  if (!isServiceRoleConfigured()) return { ok: false, message: SERVICE_UNAVAILABLE_ERROR };

  const userId = String(input?.userId ?? "");
  const username = normalizeUsername(String(input?.username ?? ""));

  if (!isValidUsername(username)) {
    return { ok: false, message: `That username isn’t valid. ${USERNAME_HINT}` };
  }

  const target = await loadManageableTarget(ctx, userId);
  if (!target) return { ok: false, message: FORBIDDEN };

  try {
    if (await usernameTaken(username, userId)) {
      return { ok: false, message: "That username is already taken." };
    }
    await setProfileUsername(userId, username);
  } catch (error) {
    return { ok: false, message: errorMessage(error, GENERIC_FAILURE) };
  }

  await logAuthEvent({
    action: "username_set",
    actorId: ctx.userId,
    targetUserId: userId,
  });

  return {
    ok: true,
    message: `Username set for ${target.full_name ?? username}. Their email and password are unchanged.`,
  };
}

export async function adminSetUserActive(input: {
  userId: string;
  isActive: boolean;
}): Promise<AdminResult> {
  const ctx = await getAdminContext();
  if (!ctx) return { ok: false, message: FORBIDDEN };
  if (!isServiceRoleConfigured()) return { ok: false, message: SERVICE_UNAVAILABLE_ERROR };

  const userId = String(input?.userId ?? "");
  const isActive = Boolean(input?.isActive);

  if (userId === ctx.userId) {
    return { ok: false, message: "You can’t change your own account status." };
  }

  const target = await loadManageableTarget(ctx, userId);
  if (!target) return { ok: false, message: FORBIDDEN };

  if (!isActive && isAdminRole(target.role)) {
    try {
      const remaining = await countRemainingAdmins({
        exceptUserId: userId,
        organization: target.organization,
        targetIsSuperAdmin: target.role === "super_admin",
      });
      if (remaining === 0) {
        return {
          ok: false,
          message: "You can’t deactivate the last administrator of this app.",
        };
      }
    } catch {
      return { ok: false, message: GENERIC_FAILURE };
    }
  }

  try {
    await setUserActive({ userId, isActive, updatedBy: ctx.userId });
  } catch {
    return { ok: false, message: GENERIC_FAILURE };
  }

  await logAuthEvent({
    action: isActive ? "user_reactivated" : "user_deactivated",
    actorId: ctx.userId,
    targetUserId: userId,
  });

  return {
    ok: true,
    message: isActive
      ? "Account reactivated for this app."
      : "Account deactivated for this app. Their data is untouched.",
  };
}

/**
 * Generates a strong temporary password, sets it through the Supabase admin API,
 * forces a change at next sign-in and (when it came from a request) closes the
 * request. The password is returned ONCE and never stored, logged or emailed.
 *
 * An organization admin can only do this for their own organization's rank and
 * file — another administrator's or a platform administrator's password can
 * only be reset by a platform administrator.
 */
export async function adminSetTemporaryPassword(input: {
  userId: string;
  requestId?: string | null;
}): Promise<AdminResult> {
  const ctx = await getAdminContext();
  if (!ctx) return { ok: false, message: FORBIDDEN };
  if (!isServiceRoleConfigured()) return { ok: false, message: SERVICE_UNAVAILABLE_ERROR };

  const limit = await enforceRateLimit({
    bucket: "admin_password_reset",
    userLimit: 20,
    windowSeconds: 900,
    ipLimit: 60,
  });
  if (!limit.ok) return { ok: false, message: TOO_MANY_ATTEMPTS_ERROR };

  const userId = String(input?.userId ?? "");
  const requestId = input?.requestId ? String(input.requestId) : null;

  const target = await getProfileIdentity(userId);
  if (!target) return { ok: false, message: "That account no longer exists." };

  if (target.id !== ctx.userId && !ctx.isSuperAdmin) {
    if (isAdminRole(target.role)) {
      return {
        ok: false,
        message:
          "Only a platform administrator can reset another administrator’s password.",
      };
    }
    if (
      !ctx.profile.organization ||
      target.organization !== ctx.profile.organization
    ) {
      return { ok: false, message: FORBIDDEN };
    }
  }

  const tempPassword = generateTemporaryPassword();
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: tempPassword,
  });

  if (error) {
    console.warn(`[admin] password reset failed (${error.status ?? "unknown"})`);
    return { ok: false, message: GENERIC_FAILURE };
  }

  await setMustChangePassword(userId, true);

  if (requestId) {
    const { error: requestError } = await admin
      .from("password_reset_requests")
      .update({
        status: "done",
        handled_by: ctx.userId,
        handled_at: new Date().toISOString(),
      })
      .eq("id", requestId)
      .eq("user_id", userId);
    if (requestError) {
      console.warn("[admin] reset request could not be closed");
    }
  }

  await logAuthEvent({
    action: "admin_reset",
    actorId: ctx.userId,
    targetUserId: userId,
  });

  return {
    ok: true,
    message: `Temporary password set for ${target.full_name ?? target.username ?? "the user"}.`,
    tempPassword,
  };
}

export async function adminRejectResetRequest(input: {
  requestId: string;
}): Promise<AdminResult> {
  const ctx = await getAdminContext();
  if (!ctx) return { ok: false, message: FORBIDDEN };
  if (!isServiceRoleConfigured()) return { ok: false, message: SERVICE_UNAVAILABLE_ERROR };

  const requestId = String(input?.requestId ?? "");
  const admin = createAdminClient();

  const { data: request, error: readError } = await admin
    .from("password_reset_requests")
    .select("id, user_id, status")
    .eq("id", requestId)
    .maybeSingle();

  if (readError || !request) {
    return { ok: false, message: "That request no longer exists." };
  }

  if (!ctx.isSuperAdmin) {
    const userId = request.user_id ? String(request.user_id) : null;
    const target = userId ? await loadManageableTarget(ctx, userId) : null;
    if (!target) return { ok: false, message: FORBIDDEN };
  }

  const { error } = await admin
    .from("password_reset_requests")
    .update({
      status: "rejected",
      handled_by: ctx.userId,
      handled_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("status", "pending");

  if (error) return { ok: false, message: GENERIC_FAILURE };
  return { ok: true, message: "Request rejected." };
}
