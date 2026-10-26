import { cookies } from "next/headers";
import { FORCED_CHANGE_COOKIE } from "@/lib/auth/session-constants";

/**
 * Keeps the session cookie in step with `profiles.must_change_password`.
 *
 * Called from server actions only (sign-in and change-password), where cookies
 * are writable. Middleware reads the cookie to redirect without a database
 * query; the portal layout and the change-password page read the column itself,
 * so a missing or stale cookie can never skip the change.
 */
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
} as const;

/** Sign-in used a temporary password: every route leads to /change-password. */
export function markForcedChangePending(): void {
  try {
    cookies().set(FORCED_CHANGE_COOKIE, "1", {
      ...COOKIE_OPTIONS,
      maxAge: 60 * 60 * 24 * 30,
    });
  } catch {
    // Read-only cookie context (a Server Component): the layout still enforces
    // the change from the database, so this is an optimisation only.
  }
}

/** The user has chosen their own password. */
export function clearForcedChangePending(): void {
  try {
    cookies().delete(FORCED_CHANGE_COOKIE);
  } catch {
    // Same as above — nothing to do.
  }
}
