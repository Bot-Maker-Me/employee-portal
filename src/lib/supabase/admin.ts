import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/env";

/**
 * Service-role client for the SHARED Supabase project (the one this app uses).
 *
 * SECURITY
 *   - The key is read from the server env var `SUPABASE_SERVICE_ROLE_KEY` only.
 *     It is never a NEXT_PUBLIC_* value and must never reach the browser.
 *   - This module must be imported from server code only (Server Components,
 *     Server Actions, Route Handlers). Nothing here is returned to the client.
 *   - The login flow uses it to resolve a username to that account's auth email
 *     and to read app_user_status; admin flows use it for the Auth Admin API.
 *     The email and any password value stay on the server: no logs, no errors,
 *     no responses.
 */
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

/** True only when the server-side service role key is configured. */
export function isServiceRoleConfigured(): boolean {
  return SERVICE_ROLE_KEY.length > 0;
}

/** Server-only Supabase client with the service role key. */
export function createAdminClient(): SupabaseClient {
  if (!SERVICE_ROLE_KEY) {
    // Never include the value in the error — just the fact that it is missing.
    throw new Error("SERVICE_ROLE_KEY_NOT_CONFIGURED");
  }
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
