/**
 * Supabase connection values, resolved once for every client.
 *
 * NEXT_PUBLIC_* env vars win, so a deployment can point at its own Supabase
 * project. When they are absent (no .env file, fresh clone, preview runtime)
 * we fall back to the project provisioned for this app instead of throwing
 * "Your project's URL and Key are required to create a Supabase client!".
 *
 * Only the publishable (anon) key belongs here — the service role key must
 * never reach the browser.
 */
const FALLBACK_SUPABASE_URL = "https://yykeefdtlqoublhomfgg.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY =
  "sb_publishable_BxVvS2t2OuYXej519eU0Pg_cT4Xp-YN";

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || FALLBACK_SUPABASE_URL;

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || FALLBACK_SUPABASE_ANON_KEY;
