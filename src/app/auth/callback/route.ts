import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { clientIpFromHeaders, enforceIpRateLimit } from "@/lib/rate-limit";

/** Default landing path once a code has been exchanged. */
function safeNext(next: string | null) {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/home";
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  // Throttle code-exchange attempts per IP (runs before a session exists).
  const limit = await enforceIpRateLimit({
    bucket: "auth_callback",
    limit: 30,
    windowSeconds: 60,
    ip: clientIpFromHeaders(request.headers),
  });
  if (!limit.ok) {
    return NextResponse.redirect(`${origin}/login?error=rate_limited`);
  }

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
