import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { USER_ID_HEADER } from "@/lib/auth/session-constants";

/**
 * The signed-in user's id.
 *
 * Middleware has already validated the session for this request and passes the
 * id in a request header, so pages, layouts and route handlers read it from
 * there instead of calling `auth.getUser()` — which is a network round trip to
 * Supabase Auth on every render. Dropping those duplicate calls is the main
 * reason navigation is fast.
 *
 * When the header is absent (a route reached without middleware, or an internal
 * invocation) we fall back to the real network check, so this is never weaker
 * than calling `getUser()` directly.
 */
export async function getSessionUserId(): Promise<string | null> {
  const fromMiddleware = headers().get(USER_ID_HEADER);
  if (fromMiddleware) return fromMiddleware;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}
