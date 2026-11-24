/**
 * Supabase connection values, resolved once for every client.
 *
 * Both come from NEXT_PUBLIC_* env vars (set in Vercel for Production and
 * Preview, and in `.env.local` for development — see `.env.example`).
 *
 * The URL is not a secret, so it keeps a fallback to this app's project. The
 * publishable (anon) key deliberately has NO hard-coded fallback: keys don't
 * belong in source control (Gitleaks), and a missing key should fail loudly
 * instead of silently pointing a deployment at the wrong project.
 *
 * Only the publishable (anon) key belongs here — the service role key must
 * never reach the browser.
 */
const FALLBACK_SUPABASE_URL = "https://yykeefdtlqoublhomfgg.supabase.co";

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || FALLBACK_SUPABASE_URL;

export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

if (!SUPABASE_ANON_KEY && typeof window === "undefined") {
  console.error(
    "[supabase] NEXT_PUBLIC_SUPABASE_ANON_KEY is not set — add it to .env.local or the Vercel project settings.",
  );
}
