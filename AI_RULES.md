# AI_RULES

Source of truth for how the **Employee Portal** is built. Follow it in every change.

## Tech Stack
- **Next.js (App Router)** — server components for data, route handlers/server actions for mutations, `middleware.ts` for auth.
- **TypeScript** — all source uses `.ts` / `.tsx`; no plain JavaScript.
- **Tailwind CSS** — all styling via utility classes + design tokens (see below).
- **Supabase** — Postgres, Auth, Realtime. One shared project with the sibling apps (they keep signing in with **email** + password).
- **@supabase/ssr** — cookie-based sessions; browser client in `src/lib/supabase/client.ts`, server client in `src/lib/supabase/server.ts`, session refresh + auth gates in `src/lib/supabase/middleware.ts`.
- **@supabase/supabase-js** — server-only service-role client in `src/lib/supabase/admin.ts` (`SUPABASE_SERVICE_ROLE_KEY`, never `NEXT_PUBLIC_*`). Used to resolve a username to its auth account, read `app_user_status`, and call the Auth Admin API.
- **next/font** — Playfair Display (headlines), Manrope (body), JetBrains Mono (labels/IDs).
- **lucide-react** — the only icon set.
- **clsx + tailwind-merge** via the `cn()` helper in `src/lib/utils.ts`.

## Design System (dark editorial)
- All palette values live as **CSS variables** in `:root` in `src/app/globals.css`, mapped to Tailwind tokens in `tailwind.config.ts`.
- **Never hardcode hex/brand colors in components** — use tokens (`bg-raised`, `text-ink`, `text-muted`, `border-line`, `bg-accent`, `text-accent-soft`, `text-ok`, `text-warn`, …) so the look can be re-branded per client.
- Palette: deep navy → near-black (`bg`/`raised`/`deep`) with a soft **coral** accent (`--accent #E85A5A`), warm off-white `paper`, and a frosted dark-glass surface (`bg-glass` + `border-glass-border` + `shadow-glass`).
- **Translucent colors must be their own `rgba` tokens.** Tailwind can't blend alpha into a plain `var()` color, so `/opacity` modifiers are silently dropped (no CSS emitted) — e.g. `border-paper-ink/10` renders nothing and falls back to the base `border-color`. Use the explicit tokens instead: `--paper-line`, `--paper-hover`, `--paper-muted`, `--accent-ring`, `--accent-tint`, `--glass-border`.
- Signature elements: `SectionMarker` (coral line + mono `§ 0X · LABEL`), `LiveTicker` (pulsing coral dot + `LIVE` + mono status), cream `LedgerCard` (`bg-paper` / `text-paper-ink`).
- Typography: serif headlines, 15px muted body, mono UPPERCASE labels (`.label-mono`). Buttons are rectangular (3px radius), mono uppercase; focus rings use the accent color.
- Decorative tilt only on non-interactive cards. Respect `prefers-reduced-motion` (handled globally).
- **Motion kit**: shared primitives live in `tailwind.config.ts` + `globals.css` — `animate-rise / rise-sm / rise-left / rise-right / blur-in / scale-in / slide-down / draw-line / shimmer / flow / float / float-soft / bounce-dot`, plus `.stagger` (reads a `--i` index so lists cascade — components that take one must accept a `style` prop), `.hover-lift`, `.sheen`, `.text-reveal`, `.text-glow`, `.paper-texture`, `.scroll-slim`, and the `.silk` backdrop. Easing is tuned once via the `--ease-expo / --ease-soft / --ease-spring` tokens. Compose these instead of inventing one-off animations.
- **Silk backdrop**: `<div className="silk">` in `src/app/layout.tsx` renders blurred blue fields (`--silk-*` tokens), a light beam, faint ledger rules, grain and drifting light particles (`LightParticles` → `.particle` / `.particle-orb`). Intensity is tuned via the `--silk-*` / `--glint*` tokens only; particle positions/timings come from the fixed table in `src/components/light-particles.tsx` (never randomised, so SSR matches). It is decorative, `aria-hidden`, sits at `z-index: -1`, and must stay dim (no bright whites) so the coral accent text keeps contrast. Neutralised by `prefers-reduced-motion`.

## Structure
- App Router pages in `src/app/`; public auth pages are `login` (username + password) and `forgot-password` (asks an administrator to reset). There is **no** sign-up, magic link or email reset in this app. `change-password` is signed-in only and forced by middleware while `profiles.must_change_password` is true. The authenticated area is the `src/app/(portal)/` route group (`home`, `pharmacy`, `team`, `account`, `admin`, `admin/users`, `admin/password-requests`).
- Reusable components in `src/components/`; UI primitives in `src/components/ui/`; admin components in `src/components/admin/`.
- Data/helpers in `src/lib/` (`profile.ts`, `admin.ts`, `features.ts`, `channels.ts`, `topics.ts`, `app-status.ts`, `auth/*`, `admin/*`, `supabase/*`).
- **Pharma Portal bridge** lives in `src/lib/pharma/` (`client.ts`, `directory.ts`, `chat.ts`, `identity.ts`, `actions.ts`) and is **server-only**. Pharmacy Chat reads/writes the separate Pharma/Nursing project (`tenants`, `tenant_members`, `profiles`, `topic_threads`, `topic_messages`). It authenticates with `PHARMA_SUPABASE_SERVICE_ROLE_KEY` (server env only — never `NEXT_PUBLIC_*`). The URL falls back to `https://ayvpdpthxwplbsmhpbva.supabase.co`.
- **Cross-project identity**: never write Employee Portal user ids into Pharma columns that reference that project's `auth.users` (`topic_threads.created_by`, `topic_messages.sender_id`) — the id does not exist there and the insert fails with FK error `23503`. Resolve via `identity.ts` (email match) or pass `NULL` with `sender_side = 'employee'`. Pharma Chat does not use `topic_*` RLS or a shared project — the service-role bridge is the only access path.
- **Live chat**: the message list is client state — new messages render optimistically on send and are reconciled with the stored row the action returns; incoming messages arrive by polling `GET /api/pharmacy/threads/[id]/messages?since=<iso>` every 4s while the tab is visible. That route re-checks auth/org itself. Keep server actions off the hot path: no full-page `revalidatePath` when sending.
- SQL for the shared Supabase project lives in `sql/` and is delivered for the user to run — never run silently.
- **Hardening migrations** live in `supabase/migrations/NNNN_name.sql`: additive, idempotent, versioned, never editing an older file and never dropping data/columns. Diagnostics in `supabase/audit/`, security tests in `supabase/tests/`. Secrets use `.env.local` (git-ignored) with `.env.example` as the committed template — `SUPABASE_SERVICE_ROLE_KEY` and `PLACEHOLDER_EMAIL_DOMAIN` are server-only, never `NEXT_PUBLIC_*`.
- **Server-side rate limiting** lives in `src/lib/rate-limit.ts` (+ `rate_limits` table / `check_rate_limit*` RPCs). Enforce it in every route handler and server action; request inputs are parsed with zod schemas from `src/lib/validation.ts`.

## Roles & Approval
- `profiles.role`: `employee` | `admin` | `super_admin`. `profiles.status`: `pending` | `active`.
- `super_admin` is the platform owner (no `organization` required): creates/deletes organizations, approves users, assigns organizations, toggles features for any org.
- `admin` manages users for their own `organization`; only `super_admin` toggles feature flags.
- **No self-registration.** An admin creates the account (`full name`, `username`, `role`, organization) at `/admin/users`, or generates a batch of up to 50 at once (`<prefix>001…`, `adminBulkCreateUsers`); the auth user gets a hidden placeholder email (`PLACEHOLDER_EMAIL_DOMAIN`, pre-confirmed, never shown or used for sending) and a one-time temporary password shown once on screen.
- New profiles created that way start `active` with `must_change_password = true` (forced to `/change-password`). Accounts approved through `PendingApproval` follow the old flow; only `active` profiles enter the portal.
- `profiles.username` is nullable and stored lowercase; a partial unique index on `lower(username)` makes it unique case-insensitively. `profiles.username`/`must_change_password` are NEVER changed by clients — server actions only.
- **Username charset is deliberately forgiving** (`USERNAME_PATTERN` in `src/lib/auth/username.ts`): 3–32 chars, letters, numbers, space, `. _ - '` (migration `0004_username_charset.sql` relaxed the original `[a-z0-9._-]` CHECK). `normalizeUsername` trims, lowercases and collapses whitespace runs on EVERY write and lookup, so case and double spaces can never lock anyone out — keep that invariant when touching either side.
- Admin actions run through `SECURITY DEFINER` RPCs (`admin_*`) that re-check the caller's role server-side — the client never uses a service-role key.

## Security & Privacy (healthcare)
- Server-side session checks in `middleware.ts`; unauthenticated users are redirected to `/login`.
- **Never** expose `SUPABASE_SERVICE_ROLE_KEY` to the client or `NEXT_PUBLIC_*`. Client env is only `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.
- **Push notifications**: the VAPID public key is client-safe (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, with a project fallback in `src/lib/push.ts`); the VAPID private key is server-only — `VAPID_PRIVATE_KEY`, never `NEXT_PUBLIC_*`, read by `src/lib/push-server.ts`. `POST /api/push/send` only ever alerts the caller's own devices (table `push_subscriptions`, own-rows RLS), so no service-role key is needed. Push payloads carry **no message content** — they can surface on a lock screen.
- No message content in logs, errors, or analytics. Render message text as plain text — never `dangerouslySetInnerHTML`.
- Rate-limit sending (max 20 messages/minute per user). Idle sign-out after 30 minutes (warn at 28).
- **Fail closed**: if the profile can't load render `UnlinkedAccount`; if it isn't `active` render `PendingApproval`; if `active` but with no `organization` (and not `super_admin`) render `UnlinkedAccount`. Never render portal data in these states.
- Respect feature flags from `features` + `tenant_features` (`employee_team_chat`, `employee_pharmacy_topics`); hide nav items and block routes when OFF (`FeatureDisabled`).
- RLS is mandatory on every table; policies scope rows to the user's own organization.

## Conventions
- Keep components small and focused. No partial/placeholder implementations.
- Only edit files related to the current request. Do not change existing tables or other apps' code without saying so first.
- Prefer existing libraries (Supabase, Tailwind, lucide) before adding dependencies.
- Database changes are delivered as SQL for the user to run — never invented or run silently.

## Username Sign-in (this app only)
- Login is **username + password**. The username is trimmed + lowercased server-side, resolved to the account's auth email with the service role key (`src/lib/auth/actions.ts` → `usernameSignIn`), and only then passed to `signInWithPassword`. The email never reaches the browser, a log or an error message.
- Failures are indistinguishable: wrong username, wrong password, deactivated account and account-without-username all return `Incorrect username or password.` (`src/lib/auth/username.ts`). No account match still burns an equal sign-in attempt against a dummy address.
- Lockout: `login_attempts` (server-only) — 5 failures per username **or** IP in 15 minutes blocks for 15 minutes via `TOO_MANY_ATTEMPTS_ERROR`. Every attempt is recorded.
- Per-app account state lives in `app_user_status` (`APP_KEY = 'employee_portal'` in `src/lib/app-status.ts`); a missing row means ACTIVE. Deactivating a user blocks this app only — the sibling apps are untouched.
- Passwords: user-driven change on `/change-password` + the Account page (`currentPassword` re-authenticated server-side, min 4 chars per `MIN_PASSWORD_LENGTH`, not the username, not the old password, then other sessions revoked). Admin-driven reset (`adminSetTemporaryPassword`) generates a 20-char password, forces a change and shows it ONCE. Neither path ever stores, logs, emails or audits a password. Supabase Auth's own project-wide minimum length (default 6) still applies and must be ≤ `MIN_PASSWORD_LENGTH` or the API refuses short passwords.
- Admin rules: an org admin only manages their own organization; only a platform admin may reset another admin's password; nobody may change their own app status or deactivate the last remaining admin. Every action re-checks the caller's role in the database (`src/lib/admin/guard.ts`).
- Audit actions (`auth_audit_log`): `password_changed`, `admin_reset`, `user_created`, `user_deactivated`, `user_reactivated`, `username_set`, `login_blocked` — actions only, never a secret.
- Tests: `supabase/tests/username_auth_tests.sql` (RLS). Username setup: `sql/username_setup.sql` (one paste — review, assign, print the list; only ever fills NULL usernames, numeric suffix on clashes). Manual-control variants: `sql/username_review.sql`, `sql/username_backfill.sql`.
