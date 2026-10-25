import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile";
import { getFeatureFlags } from "@/lib/features";
import { isPharmaConfigured } from "@/lib/pharma/client";
import { getThreadOrganization, listThreadMessages } from "@/lib/pharma/chat";
import { clientIpFromHeaders, enforceRateLimit } from "@/lib/rate-limit";
import { messagePollSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * Lightweight polling endpoint for the open chat.
 *
 * Returns only the messages at/after `?since=<iso timestamp>`, so the client can
 * receive new messages without re-rendering the whole page. Authorization is
 * re-checked here server-side: active + approved profile, feature enabled, and
 * the thread must belong to the caller's own organization. Message bodies are
 * never logged.
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const profile = await getProfile(user.id);
  if (!profile?.organization) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  // The client polls every 4s while visible (~15/min). 60/min per user and
  // 120/min per IP leave headroom while stopping scripted hammering.
  const limit = await enforceRateLimit({
    bucket: "pharmacy_poll",
    userLimit: 60,
    ipLimit: 120,
    windowSeconds: 60,
    ip: clientIpFromHeaders(request.headers),
  });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  const sinceRaw = new URL(request.url).searchParams.get("since");
  const parsed = messagePollSchema.safeParse({
    id: params.id,
    since: sinceRaw && sinceRaw.length > 0 ? sinceRaw : null,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID" }, { status: 400 });
  }

  const flags = await getFeatureFlags(profile.organization);
  if (!flags.employee_pharmacy_topics) {
    return NextResponse.json({ error: "DISABLED" }, { status: 403 });
  }

  if (!isPharmaConfigured()) {
    return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 503 });
  }

  const organization = await getThreadOrganization(parsed.data.id);
  if (organization !== profile.organization) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const messages = await listThreadMessages(parsed.data.id, parsed.data.since);

  return NextResponse.json(
    { messages },
    { headers: { "Cache-Control": "no-store" } },
  );
}
