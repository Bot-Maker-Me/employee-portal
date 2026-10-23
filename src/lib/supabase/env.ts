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
const FALLBACK_SUPABASE_ANON_KEY =eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5a2VlZmR0bHFvdWJsaG9tZmdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2NjQ4MzcsImV4cCI6MjEwODI0MDgzN30.tPCvPvAoldczxlQR1iUtO9BVfYW1fyq2bHTlPYtCYWI
  "sb_publishable_BxVvS2t2OuYXej519eU0Pg_cT4Xp-YN";

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || FALLBACK_SUPABASE_URL;

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || FALLBACK_SUPABASE_ANON_KEY;
