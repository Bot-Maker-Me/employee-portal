/**
 * Username rules and the constant, non-enumerating auth copy.
 *
 * Everything a failed sign-in can say is one of these two strings, so a wrong
 * username, a wrong password, a deactivated account and an account without a
 * username are indistinguishable to the caller.
 */
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 32;

/** Lowercase letters, numbers, dot, underscore, hyphen. */
export const USERNAME_PATTERN = /^[a-z0-9._-]{3,32}$/;

export const GENERIC_LOGIN_ERROR = "Incorrect username or password.";
export const TOO_MANY_ATTEMPTS_ERROR = "Too many attempts. Try again later.";
export const SERVICE_UNAVAILABLE_ERROR =
  "Sign-in is temporarily unavailable. Please contact your administrator.";

export const RESET_REQUEST_MESSAGE =
  "If this username exists, your administrator has been notified.";

/** Trimmed and lowercased — the form the database stores and matches on. */
export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

export function isValidUsername(username: string): boolean {
  return USERNAME_PATTERN.test(username);
}

/**
 * A value safe to store in `login_attempts` (lowercase, 1-64 chars) even when
 * the input was not a well-formed username.
 */
export function usernameForAttempt(username: string): string {
  const cleaned = normalizeUsername(username).slice(0, 64);
  return cleaned.length > 0 ? cleaned : "(empty)";
}

/** Proof-level copy, shown next to a field. */
export const USERNAME_HINT =
  "3–32 characters: letters, numbers, dot, underscore or hyphen.";
