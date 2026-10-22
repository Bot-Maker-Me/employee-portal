/**
 * Turns raw Supabase auth errors into short, friendly, non-technical copy.
 * Never surfaces tokens, IDs, or message content.
 */
export function friendlyAuthError(message: string | null | undefined): string {
  const text = (message ?? "").toLowerCase();

  if (!text) return "Something went wrong. Please try again.";
  if (text.includes("invalid login credentials"))
    return "That email or password isn’t right. Please try again.";
  if (text.includes("email not confirmed"))
    return "Please confirm your email address before signing in.";
  if (text.includes("too many") || text.includes("rate limit"))
    return "Too many attempts. Please wait a minute and try again.";
  if (text.includes("password should be at least"))
    return "Please choose a password with at least 8 characters.";
  if (text.includes("unable to validate email") || text.includes("invalid email"))
    return "Please enter a valid email address.";
  if (text.includes("auth session missing") || text.includes("session"))
    return "Your reset link has expired. Please request a new one.";

  return "We couldn’t complete that request. Please try again.";
}
