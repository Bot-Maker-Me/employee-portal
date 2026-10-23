# AI_RULES

Source of truth for how the **Employee Portal** is built. Follow it in every change.

## Tech Stack
- **Next.js (App Router)** — server components for data, route handlers/server actions for mutations, `middleware.ts` for auth.
- **TypeScript** — all source uses `.ts` / `.tsx`; no plain JavaScript.
- **Tailwind CSS** — all styling via utility classes + design tokens (see below).
- **Supabase** — Postgres, Auth (email/password only), Realtime. One shared project with the Pharma Portal app.
- **@supabase/ssr** — cookie-based sessions; browser client in `src/lib/supabase/client.ts`, server client in `src/lib/supabase/server.ts`, session refresh in `src/lib/supabase/middleware.ts`.
- **next/font** — Playfair Display (headlines), Manrope (body), JetBrains Mono (labels/IDs).
- **lucide-react** — the only icon set.
- **clsx + tailwind-merge** via the `cn()` helper in `src/lib/utils.ts`.

## Design System (dark editorial)
- All palette values live as **CSS variables** in `:root` in `src/app/globals.css`, mapped to Tailwind tokens in `tailwind.config.ts`.
- **Never hardcode hex/brand colors in components** — use tokens (`bg-raised`, `text-ink`, `text-muted`, `border-line`, `bg-accent`, `text-accent-soft`, `text-ok`, `text-warn`, …) so the look can be re-branded per client.
- Signature elements: `SectionMarker` (crimson line + mono `§ 0X · LABEL`), `LiveTicker` (pulsing crimson dot + `LIVE` + mono status), cream `LedgerCard` (`bg-paper` / `text-paper-ink`).
- Typography: serif headlines, 15px muted body, mono UPPERCASE labels (`.label-mono`). Buttons are rectangular (3px radius), mono uppercase; focus rings use the accent color.
- Decorative tilt only on non-interactive cards. Respect `prefers-reduced-motion` (handled globally).

## Structure
- App Router pages in `src/app/`; public auth pages are `login`, `signup`, `forgot-password`, `reset-password`, `auth/callback`. The authenticated area is the `src/app/(portal)/` route group (`home`, `pharmacy`, `team`, `account`, `admin`).
- Reusable components in `src/components/`; UI primitives in `src/components/ui/`; admin components in `src/components/admin/`.
- Data/helpers in `src/lib/` (`profile.ts`, `admin.ts`, `features.ts`, `channels.ts`, `topics.ts` + `topics-server.ts`, `auth-errors.ts`, `supabase/*`).
- SQL for the shared Supabase project lives in `sql/` and is delivered for the user to run — never run silently.

## Roles & Approval
- `profiles.role`: `employee` | `admin` | `super_admin`. `profiles.status`: `pending` | `active`.
- `super_admin` is the platform owner (no `organization` required): creates/deletes organizations, approves users, assigns organizations, toggles features for any org.
- `admin` manages users and features for their own `organization` only.
- Anyone can self-register at `/signup`; new profiles start `pending` and see `PendingApproval` until approved. Only `active` profiles enter the portal.
- Admin actions run through `SECURITY DEFINER` RPCs (`admin_*`) that re-check the caller's role server-side — the client never uses a service-role key.

## Security & Privacy (healthcare)
- Server-side session checks in `middleware.ts`; unauthenticated users are redirected to `/login`.
- **Never** expose `SUPABASE_SERVICE_ROLE_KEY` to the client or `NEXT_PUBLIC_*`. Client env is only `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.
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
