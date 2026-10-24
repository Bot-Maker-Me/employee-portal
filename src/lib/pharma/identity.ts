import { createPharmaClient, isPharmaConfigured } from "@/lib/pharma/client";

/**
 * Cross-project identity bridge.
 *
 * The Employee Portal and the Pharma/Nursing project are SEPARATE Supabase
 * projects, so an Employee Portal user id never exists in the Pharma project's
 * `auth.users`. Both `topic_threads.created_by` and `topic_messages.sender_id`
 * reference `auth.users(id)`, so writing our own id violates the foreign key.
 *
 * Best effort: match the employee's email to a Pharma-project account so the
 * pharmacy side can show who sent the message. When there is no match we return
 * null and rely on `sender_side = 'employee'` — both columns are nullable.
 */
const cache = new Map<string, string | null>();
const PAGE_SIZE = 200;
const MAX_PAGES = 10;

export async function resolvePharmaUserId(
  email: string | null | undefined,
): Promise<string | null> {
  const key = (email ?? "").trim().toLowerCase();
  if (!key || !isPharmaConfigured()) return null;
  if (cache.has(key)) return cache.get(key) ?? null;

  let resolved: string | null = null;
  try {
    const supabase = createPharmaClient();

    // Fast path: the Pharma `profiles` row mirrors the auth user's email, so a
    // single indexed lookup is enough. (If the column isn't there we fall
    // through to the auth-user listing below.)
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", key)
      .limit(1)
      .maybeSingle();
    if (profile?.id) {
      cache.set(key, profile.id as string);
      return profile.id as string;
    }

    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const { data, error } = await supabase.auth.admin.listUsers({
        page,
        perPage: PAGE_SIZE,
      });
      if (error) break;
      const users = data?.users ?? [];
      const match = users.find(
        (user) => (user.email ?? "").trim().toLowerCase() === key,
      );
      if (match) {
        resolved = match.id;
        break;
      }
      if (users.length < PAGE_SIZE) break;
    }
  } catch {
    resolved = null;
  }

  cache.set(key, resolved);
  return resolved;
}
