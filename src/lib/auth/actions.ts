"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { clientIpFromHeaders, enforceRateLimit } from "@/lib/rate-limit";
import { isUserActive, logAuthEvent } from "@/lib/app-status";
import {
  GENERIC_LOGIN_ERROR,
  SERVICE_UNAVAILABLE_ERROR,
  TOO_MANY_ATTEMPTS_ERROR,
  isValidUsername,
  normalizeUsername,
  usernameForAttempt,
} from "@/lib/auth/username";
import { isLoginBlocked, recordLoginAttempt } from "@/lib/auth/login-attempts";
import {
  clearForcedChangePending,
  markForcedChangePending,
} from "@/lib/auth/forced-change";
import { getSessionUserId } from "@/lib/auth/session";
import { MIN_PASSWORD_LENGTH, passwordProblem } from "@/lib/auth/password";
import { getProfileIdentity, setMustChangePassword } from "@/lib/auth/store";

/**
 * Username sign-in. The email never leaves this file.
 *
 * Flow: rate-limit check → resolve username to the auth account with the
 * service role → sign in with the email + password → per-app status check.
 *
 * Everything a failure can say is one of three constant strings, so a wrong
 * username, a wrong password, a deactivated account and an account with no
 * username are indistinguishable. When no account matches, a sign-in attempt is
 * still made against a dummy address so the two paths cost the same time.
 */

export type SignInResult = { ok: true; next: string } | { ok: false; message: string };

const CHANGE_PASSWORD_PATH = "/change-password";
const DUMMY_EMAIL = "no-such-user@employee-portal.invalid";

function safeNext(redirectTo: string | undefined | null): string {
  if (
    redirectTo &&
    redirectTo.startsWith("/") &&
    !redirectTo.startsWith("//") &&
    !redirectTo.startsWith(CHANGE_PASSWORD_PATH)
  ) {
    return redirectTo;
  }
  return "/home";
}

export async function usernameSignIn(input: {
  username: string;
  password: string;
  redirectTo?: string;
}): Promise<SignInResult> {
  const username = normalizeUsername(
    typeof input?.username === "string" ? input.username : "",
  );
  const password = typeof input?.password === "string" ? input.password : "";
  const ip = clientIpFromHeaders(headers());
  const attemptUsername = usernameForAttempt(username);

  if (!isServiceRoleConfigured()) {
    console.error("[auth] SUPABASE_SERVICE_ROLE_KEY is not configured");
    return { ok: false, message: SERVICE_UNAVAILABLE_ERROR };
  }

  let blocked: boolean;
  try {
    blocked = await isLoginBlocked({ username: attemptUsername, ip });
  } catch {
    // Limiter offline ⇒ fail closed rather than hand out sessions.
    return { ok: false, message: SERVICE_UNAVAILABLE_ERROR };
  }
  if (blocked) return { ok: false, message: TOO_MANY_ATTEMPTS_ERROR };

  const record = async (success: boolean) => {
    try {
      await recordLoginAttempt({ username: attemptUsername, ip, success });
    } catch {
      // Never break a sign-in because the ledger write failed; the lockout
      // check above already ran against a readable table.
      console.warn("[auth] login attempt could not be recorded");
    }
  };

  // Resolve the account (server side only).
  let email = DUMMY_EMAIL;
  let userId: string | null = null;
  let mustChangePassword = false;

  if (isValidUsername(username) && password.length > 0) {
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("id, must_change_password")
      .eq("username", username)
      .maybeSingle();

    const matchedId = profile?.id ? String(profile.id) : null;

    // The account lookup runs for a random id when nothing matched, so the two
    // paths cost the same time and cannot be told apart by timing.
    const { data: found } = await admin.auth.admin.getUserById(
      matchedId ?? crypto.randomUUID(),
    );

    if (matchedId && found?.user?.email) {
      email = found.user.email;
      userId = matchedId;
      mustChangePassword = Boolean(profile?.must_change_password);
    }
  } else {
    // Malformed input still costs an account lookup.
    const admin = createAdminClient();
    await admin.auth.admin.getUserById(crypto.randomUUID());
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !userId) {
    await record(false);
    return { ok: false, message: GENERIC_LOGIN_ERROR };
  }

  // Deactivated in THIS app? Sign straight back out, same generic message.
  let active: boolean;
  try {
    active = await isUserActive(userId);
  } catch {
    active = false;
  }

  if (!active) {
    await supabase.auth.signOut();
    await record(false);
    await logAuthEvent({ action: "login_blocked", actorId: userId, targetUserId: userId });
    return { ok: false, message: GENERIC_LOGIN_ERROR };
  }

  await record(true);

  // Keep the session cookie in step with the database flag, so middleware can
  // gate every route without a query of its own.
  if (mustChangePassword) markForcedChangePending();
  else clearForcedChangePending();

  return {
    ok: true,
    next: mustChangePassword ? CHANGE_PASSWORD_PATH : safeNext(input?.redirectTo),
  };
}

/** ---------------------------------------------------------------------------
 *  Change password (the user knows their current password).
 *  ------------------------------------------------------------------------ */

export type ChangePasswordResult = { ok: true } | { ok: false; message: string };

export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<ChangePasswordResult> {
  const supabase = createClient();
  const userId = await getSessionUserId();

  if (!userId) {
    return { ok: false, message: "Your session has ended. Please sign in again." };
  }

  const limit = await enforceRateLimit({
    bucket: "password_change",
    userLimit: 10,
    windowSeconds: 900,
    ipLimit: 30,
  });
  if (!limit.ok) return { ok: false, message: TOO_MANY_ATTEMPTS_ERROR };

  const current = typeof input?.currentPassword === "string" ? input.currentPassword : "";
  const next = typeof input?.newPassword === "string" ? input.newPassword : "";
  const confirm = typeof input?.confirmPassword === "string" ? input.confirmPassword : "";

  if (next !== confirm) {
    return { ok: false, message: "Those passwords don’t match." };
  }

  if (!isServiceRoleConfigured()) {
    console.error("[auth] SUPABASE_SERVICE_ROLE_KEY is not configured");
    return { ok: false, message: SERVICE_UNAVAILABLE_ERROR };
  }

  const identity = await getProfileIdentity(userId);
  const admin = createAdminClient();
  const { data: found } = await admin.auth.admin.getUserById(userId);
  // The AUTH email, not profiles.email: an admin-created account has a hidden
  // placeholder address that never appears in the app.
  const authEmail = found?.user?.email ?? null;

  if (!identity || !authEmail) {
    return { ok: false, message: SERVICE_UNAVAILABLE_ERROR };
  }

  const problem = passwordProblem({
    password: next,
    username: identity.username,
    currentPassword: current,
  });
  if (problem) return { ok: false, message: problem };

  // Verify the current password by re-authenticating (server side only: the
  // email is never sent to the browser). This also refreshes the session.
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: authEmail,
    password: current,
  });

  if (verifyError) {
    const text = (verifyError.message ?? "").toLowerCase();
    if (text.includes("too many") || text.includes("rate")) {
      return { ok: false, message: TOO_MANY_ATTEMPTS_ERROR };
    }
    return { ok: false, message: "Your current password isn’t right." };
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
    password: next,
  });

  if (updateError) {
    const text = (updateError.message ?? "").toLowerCase();
    if (text.includes("at least") || text.includes("weak")) {
      // Supabase has its own project-wide minimum length (Authentication →
      // Settings). Echo the number it actually enforces so the message is
      // never wrong, and fall back to ours when it is not stated.
      const stated = Number((updateError.message.match(/(\d+)/) ?? [])[1] ?? 0);
      const minimum =
        Number.isFinite(stated) && stated > 0 ? stated : MIN_PASSWORD_LENGTH;
      return { ok: false, message: `Please use at least ${minimum} characters.` };
    }
    return { ok: false, message: "We couldn’t update your password. Please try again." };
  }

  // Sign in again so this tab keeps a session that is valid after the change…
  await supabase.auth.signInWithPassword({ email: authEmail, password: next });

  // …then drop every other session for this account.
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) {
      await admin.auth.admin.signOut(session.access_token, "others");
    }
  } catch {
    console.warn("[auth] could not revoke other sessions");
  }

  await setMustChangePassword(userId, false);
  clearForcedChangePending();
  await logAuthEvent({
    action: "password_changed",
    actorId: userId,
    targetUserId: userId,
  });

  return { ok: true };
}
