/**
 * Username rules and the constant, non-enumerating auth copy.
 *
 * Everything a failed sign-in can say is one of these two strings, so a wrong
 * username, a wrong password, a deactivated account and an account without a
 * username are indistinguishable to the caller.
 */
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 32;

/**
 * Letters, numbers, spaces and . _ - ' — deliberately forgiving, so an
 * administrator can type a name the way they would write it: "Sherif Youssef",
 * "Sherif.Youssef", "O'Brien", "staff-01", "staff_01".
 *
 * Input is trimmed, lowercased and whitespace-collapsed by `normalizeUsername`
 * before it is stored or matched, so the case an administrator types never
 * matters and a double space can never lock anyone out. Stored values stay
 * lowercase, which is what the database CHECK and the unique index on
 * `lower(username)` expect.
 */
export const USERNAME_PATTERN = /^[a-z0-9 ._'-]{3,32}$/i;

export const GENERIC_LOGIN_ERROR = "Incorrect username or password.";
export const TOO_MANY_ATTEMPTS_ERROR = "Too many attempts. Try again later.";
export const SERVICE_UNAVAILABLE_ERROR =
  "Sign-in is temporarily unavailable. Please contact your administrator.";

export const RESET_REQUEST_MESSAGE =
  "If this username exists, your administrator has been notified.";

/**
 * Trimmed, lowercased and with runs of whitespace collapsed to one space — the
 * form the database stores and matches on. "Sherif  Youssef " ⇒ "sherif youssef".
 */
export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, " ");
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
  "3–32 characters: letters, numbers, spaces, dot, underscore, hyphen or apostrophe.";
