import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/env";

/**
 * Routes reachable without a session.
 *
 * There is no email sign-up, no magic link and no email reset in this app:
 * `/login` takes a username + password and `/forgot-password` asks an
 * administrator to issue a temporary password.
 */
const PUBLIC_PREFIXES = ["/login", "/forgot-password"];

/** The only page a user with `must_change_password` may reach. */
const CHANGE_PASSWORD_PATH = "/change-password";

function isPublic(pathname: string) {
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * True when the signed-in user still has to choose a password.
 *
 * Reads the caller's own profile row through RLS. Any failure returns false and
 * is caught by the fail-closed checks in the portal layout, which never renders
 * data without a usable profile.
 */
async function mustChangePassword(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("profiles")
      .select("must_change_password")
      .eq("id", userId)
      .maybeSingle();
    return Boolean(data?.must_change_password);
  } catch {
    return false;
  }
}

/**
 * Refreshes the Supabase session on every request and enforces server-side
 * auth: unauthenticated users are redirected to /login, signed-in users away
 * from the login page, and anyone who still owes a password change to
 * /change-password — direct URLs included.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: { name: string; value: string; options: CookieOptions }[],
      ) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // IMPORTANT: getUser() revalidates the token with Supabase Auth.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user) {
    if (isPublic(pathname)) return response;

    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (pathname !== "/") url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  const owed = await mustChangePassword(supabase, user.id);

  if (owed && pathname !== CHANGE_PASSWORD_PATH) {
    const url = request.nextUrl.clone();
    url.pathname = CHANGE_PASSWORD_PATH;
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (!owed && pathname === CHANGE_PASSWORD_PATH) {
    const url = request.nextUrl.clone();
    url.pathname = "/home";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (owed) return response;

  if (pathname === "/login" || pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/home";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
