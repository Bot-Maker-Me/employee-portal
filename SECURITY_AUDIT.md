# Employee Portal — Security Audit

**Scope:** the whole repo (`src/`), the delivered SQL (`sql/`), and the Supabase
architecture it targets — RLS, backend rate limiting, frontend exposure, storage
& auth, and update-safety.

**Method:** static review of every server/client entry point and every SQL
statement, plus the threat model of "an authenticated low-privilege user (or an
anonymous visitor) talking straight to PostgREST with the publishable key".

**Ground rule honoured:** all schema changes are new, **additive**, versioned
files in `supabase/migrations/`. Nothing here drops data, columns, or rows, and
no existing migration was edited.

---

## 1. Fixes shipped in this change

| File | Purpose |
| --- | --- |
| `supabase/migrations/0001_security_hardening_rls.sql` | RLS on every app table, owner/org-scoped policies, `USING (true)` cleanup, **privilege-escalation lockdown** on `profiles`, indexes, `security_invoker` views |
| `supabase/migrations/0002_rate_limits.sql` | `rate_limits` counter table + `check_rate_limit` / `check_rate_limit_ip` RPCs, plus a 20/min DB guard on team-chat messages |
| `supabase/audit/inventory.sql` | Read-only Security/Performance-Advisor-equivalent queries |
| `supabase/tests/security_tests.sql` | Impersonated A/B/anon RLS tests + escalation tests |
| `src/lib/rate-limit.ts` | Server-only per-user + per-IP limiter |
| `src/lib/validation.ts` | zod schemas for every server entry point |
| `src/app/api/push/send/route.ts` | + rate limit, + size limit, + schema |
| `src/app/api/pharmacy/threads/[id]/messages/route.ts` | + rate limit, + id/`since` validation |
| `src/app/auth/callback/route.ts` | + per-IP throttle, safe `next` |
| `src/lib/pharma/actions.ts` | + validation and rate limits on thread create / send / member list |
| `.env.example`, `.gitignore` | Secret hygiene |

Run order: `0001` → `0002` → `inventory.sql` → `security_tests.sql`.

---

## 2. Findings

### A. RLS and database access

**A1 — `profiles` has no policy definition in this repo (High).**
The only SQL touching `profiles` is `sql/admin_signup_setup.sql`, which adds a
`status` column but never enables RLS or creates a policy. Whatever policies
exist were created out-of-band, so the owner-scoping claim cannot be verified,
and any permissive `UPDATE` policy is a direct escalation path.
*Exploit:* `PATCH /rest/v1/profiles?id=eq.<your-own-id>` with
`{"role":"super_admin"}` — if you can update your own row, you become platform
admin.
*Fix:* `0001` §3 binds `profiles` SELECT/UPDATE to `id = (select auth.uid())`.

**A2 — Privilege escalation through editable profile fields (Critical).**
`role`, `status`, `organization` (and `pharmacy_id` / `home_id`) live on the row
each user can edit. Even with a correct owner-scoped policy, "own row" includes
those columns.
*Exploit:* same PATCH as A1, or `organization = "<someone else's org>"` to jump
tenants.
*Fix:* `0001` §4 locks it three ways — owner-scoped RLS, `REVOKE … UPDATE` +
`GRANT UPDATE (full_name)` column privileges, and a `BEFORE UPDATE` trigger that
rejects changes to `role`/`status`/`organization` unless the write comes from the
service role or an admin RPC. The admin RPCs (`admin_set_role`, `admin_approve_user`,
`admin_set_user_organization`, `admin_delete_organization`) were re-declared to
flip an explicit `app.allow_profile_privilege_change` flag **after** their own
role checks pass, so the trigger never weakens them.

> Note on "move sensitive fields to a separate table": because the instruction
> also forbids altering existing columns — and the app reads `profiles.role` etc.
> everywhere — the columns stay in place and are made effectively read-only to
> their owner instead. That is the same guarantee without a data migration.

**A3 — Always-true policies (High).**
Any `USING (true)` / `WITH CHECK (true)` policy on user-data tables exposes every
row or lets anyone write anything.
*Exploit:* a `USING (true)` SELECT on `profiles` leaks the whole staff directory
(emails, orgs); a `WITH CHECK (true)` INSERT on `push_subscriptions` lets anyone
register arbitrary endpoints.
*Fix:* `0001` §2 drops every always-true policy on the user-data tables
(`profiles`, `tenant_features`, `push_subscriptions`, `employee_*`) and re-creates
scoped ones. `organizations` and `features` keep a documented `true` **read-only**
policy because they are deliberate public registries (names / flag defaults only,
no writes).

**A4 — Anonymous role not explicitly revoked (Medium).**
Supabase grants table privileges broadly by default. Even though the app's
policies are `to authenticated`, defence-in-depth says anon must hold nothing.
*Fix:* `0001` §4 revokes `anon` on `profiles`; every other policy is
`to authenticated` and anon-only tables get no grant. `inventory.sql` §9 lists
anything anon can still touch.

**A5 — Unindexed policy columns (Medium/Performance).**
Predicates on `organization`, `user_id`, `channel_id`, `sender_id` were not all
indexed.
*Fix:* `0001` §6 adds them, guarded by `to_regclass`.

**A6 — `topic_threads.organization_id` receives a user id (Low, data integrity).**
`createPharmacyThread` writes `organization_id: session.userId`. Authorization
uses `organization_name`, so this is not exploitable today, but the column is
semantically wrong and will mislead any future RLS that trusts it.
*Fix:* documented in code; left unchanged to avoid altering the Pharma schema.
Recommend a follow-up `ALTER TABLE … RENAME` under your approval.

**A7 — Cross-tenant enumeration via the Pharma bridge (Medium).**
`listPharmacyMembersAction`, `listPharmacies` and `createPharmacyThread` run with
the Pharma **service-role** key (RLS bypassed) and never verify that the supplied
`pharmacyId`/`memberId` belongs to the caller's organization.
*Exploit:* an active employee calls the server action with any `pharmacyId` and
reads that pharmacy's staff list, or opens a thread against another tenant.
*Fix now:* uuid validation + per-user/per-IP rate limits (this change).
*Fix later (manual):* resolve the pharmacy→organization mapping server-side and
reject ids outside the caller's org before calling the bridge.

**A8 — Service-role bridge is the only RLS on the Pharma project (Medium).**
Cross-project chat bypasses RLS entirely and relies on app-side
`organization_name` checks.
*Fix:* keep the app-side checks (they are present and correct) and also enable
RLS on the Pharma project's `topic_*` tables. This is a change to *another*
project, so it is listed as manual and not done here.

### B. Backend rate limiting

**B1 — No server-side rate limiting anywhere (Medium).**
Only a client-side idle timeout existed. Sending, polling and push dispatch were
unbounded.
*Exploit:* script `sendPharmacyMessage`/`employee_messages.insert` to flood a
chat; hammer `/api/push/send` or the polling route.
*Fix:* `rate_limits` table + `check_rate_limit(user)` / `check_rate_limit_ip(hash)`
RPCs (`0002`), enforced through `src/lib/rate-limit.ts` on:
push send 30/min user + 60/min IP, chat poll 60/min user + 120/min IP,
pharmacy send 20/min user, thread create 10/hour user, member list 60/min user +
120/min IP, auth callback 30/min IP. Over-limit responses are `429` with a
`Retry-After` header (routes) or a `RATE_LIMITED` result (actions).

**B2 — `/api/push/send` had no body limits (Medium).**
*Fix:* `Content-Length` + post-read size cap (8 KB) → `413`, and a zod schema.

**B3 — No input validation on server actions (Medium).**
*Fix:* `src/lib/validation.ts` (zod) validates ids, enums and lengths before any
query; lengths double as the effective request-size limit.

**B4 — Auth endpoints can't be limited in-app (Medium).**
`signInWithPassword`, `signUp`, `resetPasswordForEmail` run in the browser
against Supabase Auth directly.
*Fix:* the auth **callback** is IP-limited here; enable Supabase's own Auth rate
limits in the dashboard (manual step below).

### C. Frontend exposure & secrets

**C1 — Hardcoded publishable key + URL in `src/lib/supabase/env.ts` (Info).**
`sb_publishable_…` and the project URL are committed as fallbacks. A publishable
key is **not** a secret and is safe in the client — but it is now in git history.
*Exploit:* anyone with the repo can call the project's REST API with that key;
RLS (fixed above) is what actually protects the data.
*Fix:* none required. If you want to sever the fallback, rotate the publishable
key and remove the constants.

**C2 — Hardcoded VAPID **public** key in `src/lib/push.ts` (Info).** Public by
design; the signing key (`VAPID_PRIVATE_KEY`) is server-only and never in
`NEXT_PUBLIC_*`. No action.

**C3 — `PHARMA_SUPABASE_SERVICE_ROLE_KEY` is server-only (Info / rotate if ever
committed).** It is read in `src/lib/pharma/client.ts` (server) and lives in
`.env.local`. It is **not** exposed to the client. See the rotation list below.

**C4 — `.gitignore` missed a plain `.env` (Medium).**
It only ignored `.env*.local`, so `.env` / `.env.production` could be committed.
*Fix:* `.gitignore` now ignores `.env` and `.env.*`, keeping only `.env.example`
(with no real values) in git.

**C5 — No client-side third-party API calls (verified).**
No OpenAI/Anthropic/Stripe/email/storage SDK is imported anywhere, and there is
no `dangerouslySetInnerHTML`. Message bodies render as plain text. The only
client-side writes are `push_subscriptions`, `employee_messages`,
`employee_channel_members.last_read_at` and `employee_channels.name` — all
RLS-scoped in `0001`.

### D. Storage and auth

**D1 — No storage buckets are used by the code (Info).** If you add buckets,
make them **private** with owner-scoped `storage.objects` policies and MIME/size
limits — see manual steps.

**D2 — Redirect handling is safe (verified).** `safeNext` and the login form both
require a single-leading-slash path, blocking `//evil.com` open redirects. Still
configure Supabase Auth's redirect allow-list (manual).

**D3 — Email confirmation (manual).** `SignupForm` already handles the
"no session yet" case, so enabling confirmation will not break signup.

### E. Data safety on updates

**E1 — Schema was delivered as ad-hoc, re-runnable scripts (High).**
`sql/admin_signup_setup.sql` is documented as "safe to re-run" but contains
`update public.profiles set status = 'active' where organization is not null`
(mass auto-approval) and `delete from public.tenant_features where feature_key =
'employee_team_chat'` (config loss). Re-running it in production can silently
approve users and wipe a feature override.
*Fix:* new work goes through `supabase/migrations/` (additive, versioned, never
editing an older file). `admin_signup_setup.sql` is left untouched per the
"never edit old migrations" rule — see manual steps for retiring its destructive
lines.

**E2 — Hardcoded super-admin bootstrap (Medium).**
The same script ends with
`update public.profiles set role = 'super_admin' where email = '<owner>'`.
Because it is re-runnable, that email re-acquires platform admin on every run —
a standing privilege that survives even if you later demote the account.
*Fix:* rotate to a one-time manual grant and remove the email from any
re-runnable file (manual).

**E3 — App updates never reseed production (verified).** No seed/reset runs at
boot or build; `0001`/`0002` are pure DDL/grants. Keep seed data in `sql/` dev
scripts only.

---

## 3. Verification

**Supabase Advisors.** Dashboard → *Database → Advisors* → run **Security** and
**Performance**; fix every warning. `supabase/audit/inventory.sql` reproduces the
important checks in SQL — every section should return no rows except:
§1 (RLS disabled) empty, §2 empty except `rate_limits` (deny-all is intended),
§3 rows only for `organizations` + `features` SELECT, §4 empty, §5 empty, §6
empty, §7 no `role/status/organization` row with `update_privilege = true` on
`profiles`, §8/§9 empty.

**Behavioural tests.** Run `supabase/tests/security_tests.sql` on a **staging**
project. It impersonates user A and the anon role via `set local role` +
`request.jwt.claims` (the same mechanism PostgREST uses) and asserts:

* A can read their own profile; A **cannot** read B's profile or push
  subscriptions. ✅ must hold
* A **cannot** set their own `role`/`status`/`organization. ✅ must hold
* A **cannot** insert a `push_subscriptions` row for B. ✅ must hold
* A **cannot** delete their own profile row. ✅ must hold
* `anon` **cannot** read `profiles` or `push_subscriptions`. ✅ must hold

A clean run prints only `security_tests: ALL PASSED`; any breach raises a
`FAIL:` exception.

---

## 4. What I fixed vs. what you must do in the dashboard

### Fixed in code / SQL (run the migrations)

1. RLS enabled + owner/org-scoped policies on every app table; always-true
   policies removed.
2. `profiles` privilege escalation blocked (RLS + column grants + trigger).
3. `anon` revoked from user-data tables; policy columns indexed; views set to
   `security_invoker`.
4. Server-side rate limiting (per-user **and** per-IP) with `429` + `Retry-After`,
   plus a 20/min DB guard on team-chat messages.
5. zod validation + request-size limits on every server entry point.
6. `.env.example` added; `.gitignore` now ignores all real env files.
7. Versioned, additive migration + audit + test scripts.

### You must do manually (Supabase dashboard / ops)

1. **Auth → Rate Limits:** enable limits on sign-in/sign-up/password-reset (the
   app calls Auth from the browser, so these can't be throttled in-app).
2. **Auth → URL Configuration:** restrict *Site URL* + *Redirect URLs* to your
   own domains only.
3. **Auth → Providers/Email:** enable **email confirmation**; consider requiring
   a strong password policy; enable MFA for admins.
4. **Storage:** if/when you add buckets, keep them **private**, add owner-scoped
   `storage.objects` policies, and set allowed MIME types + max file size.
5. **Pharma/Nursing project:** enable RLS on `topic_threads` / `topic_messages`
   and add the pharmacy→organization mapping needed for A7/A8.
6. **Retire the destructive lines** in `sql/admin_signup_setup.sql` (E1/E2): drop
   the mass `status='active'` update, the `tenant_features` delete, and the
   hardcoded super-admin email; grant super-admin once, by hand.
7. Run `supabase/tests/security_tests.sql` on staging after applying `0001`/`0002`.

### Keys to review / rotate

| Key | Where | Status | Action |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable) | `src/lib/supabase/env.ts` fallback + `.env.local` | Public by design; committed as a fallback | Optional: rotate + remove the fallback constant |
| Supabase project URL | `src/lib/supabase/env.ts`, `src/lib/pharma/client.ts` | Not a secret | None |
| `PHARMA_SUPABASE_SERVICE_ROLE_KEY` | `.env.local` only | Server-only, git-ignored, **not** exposed | Rotate **if** it ever appeared in a commit/chat/log; then check the Pharma project's Auth logs for anomalies |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | `src/lib/push.ts` fallback | Public by design | None |
| `VAPID_PRIVATE_KEY` | server env only | Server-only, never `NEXT_PUBLIC_*` | Rotate if ever committed |
| `SUPABASE_SERVICE_ROLE_KEY` (own project) | not used in this app | — | Never add it to the client |

If the repo or `.env.local` was ever shared outside your team, assume C3 is
exposed and rotate the Pharma service-role key immediately.

### Provider budget caps & alerts to set

No third-party paid API is called today (verified), so there is nothing to cap
yet. When you add one, set **both** a hard budget cap and a usage alert:

* **Supabase** (Billing → Spend caps + usage alerts) — guards DB egress/compute.
* **Web push** (FCM/APNs) — free, but monitor delivery failures.
* Any future **AI/email/payments** provider — set a spend cap and an alert at
  50% of it, and keep every such call **server-side** (Edge Function / route
  handler), never in `NEXT_PUBLIC_*`.
