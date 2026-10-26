/**
 * Names shared by middleware (edge runtime) and the server code that reads or
 * writes them.
 *
 * Deliberately dependency-free: importing this from `middleware.ts` must not
 * pull in `next/headers` or a Supabase server client, which are not available
 * in the middleware runtime.
 */

/**
 * Request header middleware uses to hand the ALREADY-VALIDATED user id to the
 * render pass, so pages and layouts do not each pay another Supabase Auth round
 * trip. Middleware always overwrites it (and removes it for anonymous
 * requests), so a value sent by a browser can never be trusted.
 */
export const USER_ID_HEADER = "x-ep-user-id";

/**
 * httpOnly cookie mirroring `profiles.must_change_password` for the CURRENT
 * session: written when someone signs in with a temporary password, cleared
 * when they choose their own. It lets middleware block every route — pages and
 * API routes — without a database round trip on each request. The database
 * stays the authority: the portal layout and the change-password page both read
 * the column itself.
 */
export const FORCED_CHANGE_COOKIE = "ep_pw_change";
