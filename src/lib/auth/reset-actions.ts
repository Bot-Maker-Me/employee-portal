"use server";

import { headers } from "next/headers";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { clientIpFromHeaders, enforceIpRateLimit } from "@/lib/rate-limit";
import {
  RESET_REQUEST_MESSAGE,
  SERVICE_UNAVAILABLE_ERROR,
  TOO_MANY_ATTEMPTS_ERROR,
  isValidUsername,
  normalizeUsername,
} from "@/lib/auth/username";
import { findProfileByUsername } from "@/lib/auth/store";

/**
 * "Forgot password? Ask your administrator."
 *
 * The answer is ALWAYS the same string, whether or not the username exists, so
 * this form cannot be used to enumerate accounts. When the username does match,
 * a pending request is queued for an administrator of that organization, who
 * sets a temporary password by hand.
 */
/** At most this many requests per username per day. */
const RESET_REQUESTS_PER_DAY = 3;

export type ResetRequestMappingResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function requestPasswordReset(input: {
  username: string;
}): Promise<ResetRequestMappingResult> {
  const username = normalizeUsername(
    typeof input?.username === "string" ? input.username : "",
  );

  const limit = await enforceIpRateLimit({
    bucket: "password_reset_request",
    limit: 10,
    windowSeconds: 900,
    ip: clientIpFromHeaders(headers()),
  });
  if (!limit.ok) return { ok: false, message: TOO_MANY_ATTEMPTS_ERROR };

  if (!isServiceRoleConfigured()) {
    console.error("[auth] SUPABASE_SERVICE_ROLE_KEY is not configured");
    return { ok: false, message: SERVICE_UNAVAILABLE_ERROR };
  }

  if (isValidUsername(username)) {
    try {
      const profile = await findProfileByUsername(username);
      if (profile) {
        const admin = createAdminClient();
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const { count } = await admin
          .from("password_reset_requests")
          .select("id", { count: "exact", head: true })
          .eq("username", username)
          .gte("requested_at", since);

        const { data: pending } = await admin
          .from("password_reset_requests")
          .select("id")
          .eq("username", username)
          .eq("status", "pending")
          .limit(1);

        const withinDailyLimit = (count ?? 0) < RESET_REQUESTS_PER_DAY;
        const nothingWaiting = !pending || pending.length === 0;

        if (withinDailyLimit && nothingWaiting) {
          await admin.from("password_reset_requests").insert({
            user_id: profile.id,
            username,
            status: "pending",
          });
        }
      }
    } catch {
      // Fall through to the same neutral answer: a queuing failure must not
      // reveal whether the account exists.
      console.warn("[auth] reset request could not be queued");
    }
  }

  return { ok: true, message: RESET_REQUEST_MESSAGE };
}
