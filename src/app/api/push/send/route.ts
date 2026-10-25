import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile";
import { getFeatureFlags } from "@/lib/features";
import { isPharmaConfigured } from "@/lib/pharma/client";
import { listPharmacyReplies, listThreads } from "@/lib/pharma/chat";
import { clientIpFromHeaders, enforceRateLimit } from "@/lib/rate-limit";
import { pushSendSchema } from "@/lib/validation";
import {
  isPushSendConfigured,
  sendPush,
  type PushTarget,
} from "@/lib/push-server";

export const dynamic = "force-dynamic";

/** Reject oversized bodies before parsing. The real payload is a few hundred bytes. */
const MAX_BODY_BYTES = 8 * 1024;

/**
 * Web-push dispatcher. Only ever notifies the caller's OWN devices, which is why
 * it needs no cross-user access and no service-role key.
 *
 *   { mode: "test" }                          → a test alert, to verify the keys
 *   { mode: "check", since, hidden }          → alert about new pharmacy replies
 *
 * Payloads deliberately carry no message content: they can surface on a lock
 * screen, so they only ever say that something needs attention.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "PAYLOAD_TOO_LARGE" }, { status: 413 });
  }

  const profile = await getProfile(user.id);
  if (!profile?.organization) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  // Server-side throttle: the watcher polls once a minute, so 30/min per user is
  // generous; the IP guard catches shared egress / scripted abuse.
  const limit = await enforceRateLimit({
    bucket: "push_send",
    userLimit: 30,
    ipLimit: 60,
    windowSeconds: 60,
    ip: clientIpFromHeaders(request.headers),
  });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "PAYLOAD_TOO_LARGE" }, { status: 413 });
  }

  let parsedBody: unknown = {};
  try {
    parsedBody = raw ? JSON.parse(raw) : {};
  } catch {
    // No/invalid body: fall through to the default mode below.
    parsedBody = {};
  }
  const parsed = pushSendSchema.safeParse(parsedBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID" }, { status: 400 });
  }
  const body = parsed.data;

  const { data: rows } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", user.id);
  const devices = (rows ?? []) as PushTarget[];

  if (!isPushSendConfigured()) {
    return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 503 });
  }

  if (body.mode === "test") {
    const { sent, stale } = await sendPush(devices, {
      title: "Employee Portal",
      body: "Test alert — notifications work on this device.",
      url: "/account",
      tag: "test-alert",
    });
    if (stale.length > 0) {
      await supabase.from("push_subscriptions").delete().in("endpoint", stale);
    }
    return NextResponse.json({ ok: true, sent, devices: devices.length });
  }

  const cursor = new Date().toISOString();

  const flags = await getFeatureFlags(profile.organization);
  if (!flags.employee_pharmacy_topics || !isPharmaConfigured()) {
    return NextResponse.json({ cursor, notified: 0 });
  }

  // First run just establishes the cursor — never alert for old history.
  const since = body.since ?? null;
  if (!since) return NextResponse.json({ cursor, notified: 0 });

  // Alerts only fire while the portal is in a background tab; if the user is
  // looking at the app, the open chat already updates itself.
  if (!body.hidden) return NextResponse.json({ cursor, notified: 0 });

  const threads = await listThreads(profile.organization);
  const replies = await listPharmacyReplies(
    threads.map((thread) => thread.id),
    since,
  );
  if (replies.length === 0) return NextResponse.json({ cursor, notified: 0 });

  const newest = replies[0];
  const { sent, stale } = await sendPush(devices, {
    title: "New reply from the pharmacy",
    body: "Open the Employee Portal to read it.",
    url: `/pharmacy/${newest.thread_id}`,
    tag: `pharmacy-${newest.thread_id}`,
  });
  if (stale.length > 0) {
    await supabase.from("push_subscriptions").delete().in("endpoint", stale);
  }

  return NextResponse.json({ cursor, notified: sent });
}
