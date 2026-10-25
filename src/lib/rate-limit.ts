import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

/**
 * Server-only rate limiting.
 *
 * Enforcement happens exclusively on the server: the counter lives in the
 * `public.rate_limits` table (migration 0002) and is mutated through the
 * `check_rate_limit` / `check_rate_limit_ip` RPCs, which derive the subject
 * from the signed-in user's JWT (or a hashed client IP). A browser cannot reset
 * or spoof another subject's window.
 *
 * If the RPC is unavailable (e.g. the migration has not been applied yet) we
 * FAIL OPEN and log, so a missing limiter cannot take the portal down. RLS and
 * authentication remain the primary controls.
 */

export type RateLimitOutcome = { ok: true } | { ok: false; retryAfter: number };

/** Best-effort client IP from the platform's proxy headers. */
export function clientIpFromHeaders(h: Headers): string | null {
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return h.get("x-real-ip") ?? h.get("cf-connecting-ip") ?? null;
}

type Hit = { allowed: boolean; retryAfter: number } | null;

async function hit(args: {
  scope: "user" | "ip";
  bucket: string;
  limit: number;
  windowSeconds: number;
  ip: string | null;
}): Promise<Hit> {
  const supabase = createClient();
  const { data, error } = await (args.scope === "user"
    ? supabase.rpc("check_rate_limit", {
        p_bucket: args.bucket,
        p_max: args.limit,
        p_window_seconds: args.windowSeconds,
      })
    : supabase.rpc("check_rate_limit_ip", {
        p_bucket: args.bucket,
        p_ip: args.ip ?? "unknown",
        p_max: args.limit,
        p_window_seconds: args.windowSeconds,
      }));

  if (error) {
    // Never log request content — the RPC name and code are enough.
    console.warn(
      `[rate-limit] ${args.scope} check failed (${error.code ?? "unknown"})`,
    );
    return null;
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | { allowed?: boolean; retry_after?: number }
    | undefined;
  if (!row) return null;

  return {
    allowed: Boolean(row.allowed),
    retryAfter: Number(row.retry_after ?? 0),
  };
}

/**
 * Applies a per-user limit and (optionally) a per-IP limit for one logical
 * bucket. Returns the largest Retry-After when a limit is exceeded.
 */
export async function enforceRateLimit(options: {
  bucket: string;
  userLimit: number;
  windowSeconds: number;
  ipLimit?: number;
  ip?: string | null;
}): Promise<RateLimitOutcome> {
  const ip = options.ip ?? clientIpFromHeaders(headers());

  const results = await Promise.all([
    hit({
      scope: "user",
      bucket: options.bucket,
      limit: options.userLimit,
      windowSeconds: options.windowSeconds,
      ip: null,
    }),
    options.ipLimit
      ? hit({
          scope: "ip",
          bucket: options.bucket,
          limit: options.ipLimit,
          windowSeconds: options.windowSeconds,
          ip,
        })
      : Promise.resolve(null),
  ]);

  let retryAfter = 0;
  for (const result of results) {
    if (result && !result.allowed) {
      retryAfter = Math.max(retryAfter, result.retryAfter);
    }
  }

  return retryAfter > 0 ? { ok: false, retryAfter } : { ok: true };
}

/**
 * IP-only limit for endpoints that can run before a session exists (e.g. the
 * auth callback), where a per-user subject would be meaningless.
 */
export async function enforceIpRateLimit(options: {
  bucket: string;
  limit: number;
  windowSeconds: number;
  ip?: string | null;
}): Promise<RateLimitOutcome> {
  const ip = options.ip ?? clientIpFromHeaders(headers());
  const result = await hit({
    scope: "ip",
    bucket: options.bucket,
    limit: options.limit,
    windowSeconds: options.windowSeconds,
    ip,
  });

  if (result && !result.allowed) {
    return { ok: false, retryAfter: Math.max(result.retryAfter, 1) };
  }
  return { ok: true };
}
