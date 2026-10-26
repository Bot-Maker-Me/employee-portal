/**
 * Password policy for this app.
 *
 * Deliberately permissive: this operator asked to be able to choose short
 * passwords (4 characters). The password itself is unchanged in the shared
 * project and still works for the sibling apps' email sign-in, so the policy is
 * enforced here rather than in Auth settings.
 *
 * NOTE: Supabase Auth enforces its OWN project-wide minimum length
 * (Authentication → Settings → "Minimum password length", default 6) and the
 * API rejects anything shorter. Lower that setting to match, or a password this
 * short will be refused by the server with a length error.
 */
export const MIN_PASSWORD_LENGTH = 4;
/** Supabase hashes with bcrypt: beyond 72 characters input is truncated. */
export const MAX_PASSWORD_LENGTH = 72;

export const PASSWORD_NOTE =
  "Your password is shared across all apps you use with this account.";

export type PasswordStrength = { score: 0 | 1 | 2 | 3; label: string };

/** Length + character variety, only used for the on-screen hint. */
export function passwordStrength(password: string): PasswordStrength {
  let variety = 0;
  if (/[a-z]/.test(password)) variety += 1;
  if (/[A-Z]/.test(password)) variety += 1;
  if (/[0-9]/.test(password)) variety += 1;
  if (/[^A-Za-z0-9]/.test(password)) variety += 1;

  if (password.length < MIN_PASSWORD_LENGTH) return { score: 0, label: "Too short" };
  if (password.length >= 16 && variety >= 3) return { score: 3, label: "Strong" };
  if (password.length >= 12 && variety >= 2) return { score: 2, label: "Good" };
  return { score: 1, label: "Weak" };
}

/**
 * Returns the message to show, or null when the password is acceptable.
 * `currentPassword` is optional: pass it to reject reusing the old password.
 */
export function passwordProblem(options: {
  password: string;
  username?: string | null;
  currentPassword?: string | null;
}): string | null {
  const { password, username, currentPassword } = options;

  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Please use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Please use no more than ${MAX_PASSWORD_LENGTH} characters.`;
  }
  if (username && password.toLowerCase() === username.toLowerCase()) {
    return "Your password can’t be the same as your username.";
  }
  if (currentPassword && password === currentPassword) {
    return "Please choose a password you haven’t used here before.";
  }
  if (/^\s|\s$/.test(password)) {
    return "Please don’t start or end your password with a space.";
  }
  return null;
}
