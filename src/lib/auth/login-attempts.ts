import { createAdminClient } from "@/lib/supabase/admin";

/**
 * `public.login_attempts` — the lockout ledger for username sign-in.
 *
 * Every attempt (success or failure) is recorded server-side with the service
 * role key; the table has RLS and no policies, so no client can read or write
 * it. The username is stored lowercased and the IP as received from the
 * platform proxy headers.
 */
export const LOGIN_WINDOW_MINUTES = 15;
export const LOGIN_MAX_FAILURES = 5;

type CountResult = { count: number | null; error: unknown };

function windowStart(): string {
  return new Date(Date.now() - LOGIN_WINDOW_MINUTES * 60_000).toISOString();
}

/**
 * True when this username or this IP has produced too many failures inside the
 * window. Throws when the ledger cannot be read, so the caller can fail closed
 * instead of letting an attacker through with the limiter offline.
 */
export async function isLoginBlocked(options: {
  username: string;
  ip: string | null;
}): Promise<boolean> {
  const admin = createAdminClient();
  const since = windowStart();

  const queries: PromiseLike<CountResult>[] = [
    admin
      .from("login_attempts")
      .select("id", { count: "exact", head: true })
      .eq("username", options.username)
      .eq("success", false)
      .gte("created_at", since),
  ];

  if (options.ip) {
    queries.push(
      admin
        .from("login_attempts")
        .select("id", { count: "exact", head: true })
        .eq("ip", options.ip)
        .eq("success", false)
        .gte("created_at", since),
    );
  }

  const results = await Promise.all(queries);
  for (const result of results) {
    if (result.error) throw new Error("LOGIN_LIMIT_UNAVAILABLE");
    if ((result.count ?? 0) >= LOGIN_MAX_FAILURES) return true;
  }
  return false;
}

/** Records one attempt. Never stores anything but the username, IP and result. */
export async function recordLoginAttempt(options: {
  username: string;
  ip: string | null;
  success: boolean;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("login_attempts").insert({
    username: options.username,
    ip: options.ip,
    success: options.success,
  });
  if (error) throw new Error("LOGIN_ATTEMPT_WRITE_FAILED");
}

/** Keeps request URLs short when a list has hundreds of usernames. */
const USERNAME_CHUNK = 150;

/** Most recent successful sign-in per username ("last login" in the admin UI). */
export async function lastLoginMap(
  usernames: string[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const wanted = usernames.filter(Boolean);
  if (wanted.length === 0) return result;

  const admin = createAdminClient();
  const chunks: string[][] = [];
  for (let index = 0; index < wanted.length; index += USERNAME_CHUNK) {
    chunks.push(wanted.slice(index, index + USERNAME_CHUNK));
  }

  const responses = await Promise.all(
    chunks.map((names) =>
      admin
        .from("login_attempts")
        .select("username, created_at")
        .eq("success", true)
        .in("username", names)
        .order("created_at", { ascending: false })
        .limit(500),
    ),
  );

  for (const { data, error } of responses) {
    if (error) return result;
    // Newest first: the first hit for a username is its latest sign-in.
    for (const row of data ?? []) {
      const username = String(row.username);
      if (!result.has(username)) result.set(username, String(row.created_at));
    }
  }
  return result;
}
