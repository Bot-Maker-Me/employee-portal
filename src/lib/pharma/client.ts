import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Connection to the shared Pharma Portal + Nursing Home Supabase project.
 *
 * The URL is not secret and has a safe fallback; the SERVICE ROLE KEY is
 * secret and must be provided via the PHARMA_SUPABASE_SERVICE_ROLE_KEY
 * environment variable. This module must ONLY be imported from server code
 * (Server Components, Server Actions, Route Handlers) — never the browser.
 */
const FALLBACK_PHARMA_URL = "https://ayvpdpthxwplbsmhpbva.supabase.co";

export const PHARMA_URL =
  process.env.PHARMA_SUPABASE_URL?.trim() || FALLBACK_PHARMA_URL;

const PHARMA_SERVICE_KEY =
  process.env.PHARMA_SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

/** True only when the server-side service key is configured. */
export function isPharmaConfigured(): boolean {
  return PHARMA_SERVICE_KEY.length > 0;
}

/** Server-only Supabase client for the Pharma/Nursing project. */
export function createPharmaClient(): SupabaseClient {
  if (!isPharmaConfigured()) {
    throw new Error("PHARMA_NOT_CONFIGURED");
  }
  return createClient(PHARMA_URL, PHARMA_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
