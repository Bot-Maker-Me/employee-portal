import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import {
  FORCED_CHANGE_COOKIE,
  USER_ID_HEADER,
} from "@/lib/auth/session-constants";

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
 * Refreshes the Supabase session and enforces server-side auth on every
 * request, then hands the validated user id to the render pass.
 *
 * PERFORMANCE — this runs on every navigation, every prefetch and every poll,
 * so it does exactly ONE round trip (the token check in `getUser()`):
 *   * the user id travels to pages/layouts/route handlers in a request header,
 *     so none of them repeat the Auth call;
 *   * the forced-password-change flag comes from an httpOnly cookie instead of
 *     a `profiles` query. The portal layout re-checks the column itself, so the
 *     database remains the authority and the cookie is only an optimisation.
 */
export async function updateSession(request: NextRequest) {
  // Session cookies Supabase wants to write (a refreshed access token). They
  // are applied to whichever response we return, redirects included.
  let pendingCookies: { name: string; value: string; options: CookieOptions }[] =
    [];

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: { name: string; value: string; options: CookieOptions }[],
      ) {
        pendingCookies = cookiesToSet;
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
      },
    },
  });

  // IMPORTANT: getUser() revalidates the token with Supabase Auth.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(USER_ID_HEADER);
  if (user) requestHeaders.set(USER_ID_HEADER, user.id);

  const finish = (response: NextResponse) => {
    pendingCookies.forEach(({ name, value, options }) =>
      response.cookies.set(name, value, options),
    );
    return response;
  };

  const passThrough = () =>
    finish(NextResponse.next({ request: { headers: requestHeaders } }));

  const goTo = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    return finish(NextResponse.redirect(url));
  };

  if (!user) {
    if (isPublic(pathname)) return passThrough();

    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (pathname !== "/") url.searchParams.set("redirectTo", pathname);
    return finish(NextResponse.redirect(url));
  }

  // A temporary password must be replaced before anything else is reachable —
  // API routes included.
  const owesPassword = request.cookies.get(FORCED_CHANGE_COOKIE)?.value === "1";
  if (owesPassword && pathname !== CHANGE_PASSWORD_PATH) {
    return goTo(CHANGE_PASSWORD_PATH);
  }

  // Signed in: the login page (and the root) belong to the portal.
  if (!owesPassword && (pathname === "/login" || pathname === "/")) {
    return goTo("/home");
  }

  // /change-password is NOT bounced here: the page itself reads the flag from
  // the database, so a stale cookie can never trap anyone in a redirect loop.
  return passThrough();
}
