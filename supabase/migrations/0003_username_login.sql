-- ============================================================================
-- 0003_username_login.sql
-- ----------------------------------------------------------------------------
-- Username + password sign-in for the Employee Portal.
--
-- RUN THIS IN THE SHARED SUPABASE PROJECT (the one this app already uses).
-- It is ADDITIVE and IDEMPOTENT: it only adds nullable columns and new tables.
-- It never modifies or drops an existing column, table, policy, trigger, auth
-- setting or any user's email, so the two sibling apps that keep using
-- email + password sign-in are unaffected.
--
-- DESIGN NOTES
--   * profiles.username is NULLABLE, so users of the sibling apps are untouched.
--     Usernames are always stored LOWERCASE (enforced by the CHECK below) and
--     uniqueness is case-insensitive via a unique index on lower(username).
--     The app lowercases input before every lookup, so storage must be lowercase.
--   * app_user_status is PER APP. A missing row means ACTIVE. Deactivating a
--     person here must never block them in another app, so this is never a
--     global flag.
--   * password_reset_requests, login_attempts and auth_audit_log are written by
--     server actions that hold the service role key. Clients get no write path
--     at all; only admins of this app can read.
--   * NOTHING in these tables ever stores a password, temporary password or
--     anything derived from one. auth_audit_log holds actions only.
--   * Order matters inside this file: the helper in section 2 must exist before
--     the policies below reference it.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. profiles: username + forced password change.
-- ----------------------------------------------------------------------------
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists must_change_password boolean not null default false;

do $$
begin
  -- 3-32 characters, lowercase letters, numbers, dot, underscore, hyphen.
  if not exists (select 1 from pg_constraint where conname = 'profiles_username_format_chk') then
    alter table public.profiles
      add constraint profiles_username_format_chk
      check (username is null or username ~ '^[a-z0-9._-]{3,32}$');
  end if;
end $$;

-- Case-insensitive uniqueness. Partial index: profiles without a username
-- (every user of the sibling apps, until an admin sets one) are not affected.
create unique index if not exists profiles_username_lower_key
  on public.profiles (lower(username))
  where username is not null;

comment on column public.profiles.username is
  'Employee Portal username (lowercase, 3-32 chars). NULL for users who only sign in by email elsewhere.';
comment on column public.profiles.must_change_password is
  'When true the Employee Portal forces the user to /change-password before any other page loads.';

-- ----------------------------------------------------------------------------
-- 2. Helper used by the read policies below: does the caller share an
--    organization with this user? SECURITY DEFINER so its own lookup on
--    `profiles` is not filtered by `profiles_select_own` (which hides other
--    people's rows). Defined FIRST: policies need it to exist.
-- ----------------------------------------------------------------------------
create or replace function public.shares_org_with_caller(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.profiles t
      join public.profiles me on me.id = auth.uid()
     where t.id = p_user_id
       and t.organization is not null
       and t.organization = me.organization
  );
$$;

revoke all on function public.shares_org_with_caller(uuid) from public, anon;
grant execute on function public.shares_org_with_caller(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 3. app_user_status: per-app activation. A missing row means ACTIVE.
-- ----------------------------------------------------------------------------
create table if not exists public.app_user_status (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  app_key    text        not null default 'employee_portal',
  is_active  boolean     not null default true,
  updated_by uuid        null references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint app_user_status_app_key_chk check (app_key ~ '^[a-z0-9_]{3,40}$'),
  primary key (user_id, app_key)
);

alter table public.app_user_status enable row level security;
revoke all on public.app_user_status from anon, authenticated;
-- Admins only, read-only for clients: every write goes through a server action
-- that holds the service role key. There is deliberately no INSERT/UPDATE/DELETE
-- policy, so RLS denies writes for anon and authenticated.
grant select on public.app_user_status to authenticated;

drop policy if exists app_user_status_admin_read on public.app_user_status;
create policy app_user_status_admin_read on public.app_user_status
  for select to authenticated
  using (
    public.is_admin()
    and (
      public.is_super_admin()
      or public.shares_org_with_caller(app_user_status.user_id)
    )
  );

create index if not exists app_user_status_app_key_idx
  on public.app_user_status (app_key, is_active);

-- ----------------------------------------------------------------------------
-- 4. password_reset_requests: an admin sets the new temporary password.
-- ----------------------------------------------------------------------------
create table if not exists public.password_reset_requests (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        null references auth.users (id) on delete cascade,
  username     text        not null,
  status       text        not null default 'pending',
  requested_at timestamptz not null default now(),
  handled_by   uuid        null references auth.users (id) on delete set null,
  handled_at   timestamptz null,
  constraint password_reset_requests_status_chk
    check (status in ('pending', 'done', 'rejected'))
);

alter table public.password_reset_requests enable row level security;
revoke all on public.password_reset_requests from anon, authenticated;
grant select, update on public.password_reset_requests to authenticated;

drop policy if exists password_reset_requests_admin_read on public.password_reset_requests;
create policy password_reset_requests_admin_read on public.password_reset_requests
  for select to authenticated
  using (
    public.is_admin()
    and (
      public.is_super_admin()
      or public.shares_org_with_caller(password_reset_requests.user_id)
    )
  );

drop policy if exists password_reset_requests_admin_update on public.password_reset_requests;
create policy password_reset_requests_admin_update on public.password_reset_requests
  for update to authenticated
  using (
    public.is_admin()
    and (
      public.is_super_admin()
      or public.shares_org_with_caller(password_reset_requests.user_id)
    )
  )
  with check (status in ('pending', 'done', 'rejected'));

create index if not exists password_reset_requests_pending_idx
  on public.password_reset_requests (status, requested_at desc);
create index if not exists password_reset_requests_username_idx
  on public.password_reset_requests (lower(username), requested_at desc);

-- ----------------------------------------------------------------------------
-- 5. login_attempts: every sign-in attempt (success or failure).
--    Used for the 5-failures-per-15-minutes lockout. No client access at all.
--    NOTE: the IP is stored as received from the platform proxy headers; this
--    table is only ever read by server code (see login_attempts_prune()).
-- ----------------------------------------------------------------------------
create table if not exists public.login_attempts (
  id         bigint      generated by default as identity primary key,
  username   text        not null,
  ip         text        null,
  success    boolean     not null default false,
  created_at timestamptz not null default now(),
  constraint login_attempts_username_chk
    check (username = lower(username) and char_length(username) between 1 and 64)
);

alter table public.login_attempts enable row level security;
revoke all on public.login_attempts from anon, authenticated;
-- No policies on purpose: RLS + zero policies = deny all for anon/authenticated.

create index if not exists login_attempts_username_idx
  on public.login_attempts (username, created_at desc);
create index if not exists login_attempts_ip_idx
  on public.login_attempts (ip, created_at desc);

-- ----------------------------------------------------------------------------
-- 6. auth_audit_log: who did what to whose account. Never holds a secret.
-- ----------------------------------------------------------------------------
create table if not exists public.auth_audit_log (
  id             bigint      generated by default as identity primary key,
  actor_id       uuid        null references auth.users (id) on delete set null,
  action         text        not null,
  target_user_id uuid        null references auth.users (id) on delete set null,
  app_key        text        not null default 'employee_portal',
  created_at     timestamptz not null default now(),
  constraint auth_audit_log_action_chk check (action in (
    'password_changed',
    'admin_reset',
    'user_created',
    'user_deactivated',
    'user_reactivated',
    'username_set',
    'login_blocked'
  ))
);

alter table public.auth_audit_log enable row level security;
revoke all on public.auth_audit_log from anon, authenticated;
grant select on public.auth_audit_log to authenticated;

drop policy if exists auth_audit_log_admin_read on public.auth_audit_log;
create policy auth_audit_log_admin_read on public.auth_audit_log
  for select to authenticated
  using (
    public.is_admin()
    and (
      public.is_super_admin()
      or public.shares_org_with_caller(auth_audit_log.actor_id)
      or public.shares_org_with_caller(auth_audit_log.target_user_id)
    )
  );

create index if not exists auth_audit_log_created_at_idx
  on public.auth_audit_log (created_at desc);
create index if not exists auth_audit_log_target_idx
  on public.auth_audit_log (target_user_id, created_at desc);

-- ----------------------------------------------------------------------------
-- 7. Housekeeping: drop login attempts older than a day. Call periodically
--    (e.g. a Supabase scheduled job: select public.login_attempts_prune();).
-- ----------------------------------------------------------------------------
create or replace function public.login_attempts_prune()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.login_attempts where created_at < now() - interval '1 day';
$$;

revoke all on function public.login_attempts_prune() from public, anon, authenticated;

-- ============================================================================
-- 8. Verification (read-only). Expect: 2 new profile columns and 4 new tables,
--    all with RLS enabled.
-- ============================================================================
select column_name, data_type, is_nullable, column_default
  from information_schema.columns
 where table_schema = 'public'
   and table_name = 'profiles'
   and column_name in ('username', 'must_change_password');

select c.relname as table_name, c.relrowsecurity as rls_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public'
   and c.relname in (
     'app_user_status', 'password_reset_requests', 'login_attempts', 'auth_audit_log'
   )
 order by 1;

-- ============================================================================
-- Done. Next, in this order:
--   1. sql/username_review.sql   (SELECT only — review clashes by hand)
--   2. sql/username_backfill.sql (only after you have fixed the clashes)
--   3. supabase/tests/username_auth_tests.sql (RLS checks, staging only)
-- ============================================================================
