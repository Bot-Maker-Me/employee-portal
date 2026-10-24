import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile";
import { getFeatureFlags } from "@/lib/features";
import { isPharmaConfigured } from "@/lib/pharma/client";
import { getThreadOrganization, listThreadMessages } from "@/lib/pharma/chat";

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

  const flags = await getFeatureFlags(profile.organization);
  if (!flags.employee_pharmacy_topics) {
    return NextResponse.json({ error: "DISABLED" }, { status: 403 });
  }

  if (!isPharmaConfigured()) {
    return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 503 });
  }

  const organization = await getThreadOrganization(params.id);
  if (organization !== profile.organization) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const since = new URL(request.url).searchParams.get("since");
  const messages = await listThreadMessages(params.id, since);

  return NextResponse.json(
    { messages },
    { headers: { "Cache-Control": "no-store" } },
  );
}
