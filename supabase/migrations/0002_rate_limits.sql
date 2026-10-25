-- ============================================================================
-- 0002_rate_limits.sql
-- ----------------------------------------------------------------------------
-- Server-side rate limiting infrastructure (a counter table + SECURITY DEFINER
-- RPCs). Additive and idempotent. Never drops data.
--
-- WHY THIS SHAPE
--   The app talks to Postgres with the anon/publishable key + the user's JWT, so
--   it can only ever be the `authenticated` role. There is therefore no
--   service-role key in the app to write a counter table directly. The counter
--   is instead mutated by SECURITY DEFINER functions with a pinned search_path.
--
--   The counter table itself has RLS enabled with NO policies and no grants, so
--   no client can read or write it — only the functions can.
--
--   * check_rate_limit()    → per end user (subject derived from the JWT, so it
--                             cannot be spoofed to burn another user's budget).
--   * check_rate_limit_ip() → per client IP, stored as an MD5 hash so raw IP
--                             addresses are never persisted (privacy).
--
--   Use the Supabase UI ("Auth → Rate Limits") as well — that covers the auth
--   endpoints, which this app calls directly from the browser.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Counter table.
-- ----------------------------------------------------------------------------
create table if not exists public.rate_limits (
  subject      text        not null,           -- 'user:<uuid>' | 'ip:<md5>'
  bucket       text        not null,           -- logical limit name
  window_start timestamptz not null,           -- fixed-window start
  count        integer     not null default 0,
  primary key (subject, bucket, window_start)
);

alter table public.rate_limits enable row level security;
-- No policies on purpose: RLS + zero policies = deny all for anon/authenticated.
revoke all on public.rate_limits from anon, authenticated;

create index if not exists rate_limits_window_start_idx
  on public.rate_limits (window_start);

-- ----------------------------------------------------------------------------
-- 2. Core counter (internal; not callable by clients).
-- ----------------------------------------------------------------------------
create or replace function public.rate_limit_hit(
  p_subject        text,
  p_bucket         text,
  p_max            integer,
  p_window_seconds integer
)
returns table (allowed boolean, remaining integer, retry_after integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_seconds integer := greatest(coalesce(p_window_seconds, 60), 1);
  v_max            integer := greatest(coalesce(p_max, 1), 1);
  v_window         timestamptz;
  v_count          integer;
begin
  v_window := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / v_window_seconds) * v_window_seconds
  );

  insert into public.rate_limits (subject, bucket, window_start, count)
  values (p_subject, p_bucket, v_window, 1)
  on conflict (subject, bucket, window_start)
  do update set count = public.rate_limits.count + 1
  returning count into v_count;

  allowed     := v_count <= v_max;
  remaining   := greatest(v_max - v_count, 0);
  retry_after := greatest(
    ceil(extract(epoch from (
      v_window + make_interval(secs => v_window_seconds) - clock_timestamp()
    )))::integer,
    0
  );
  return next;
end $$;

-- ----------------------------------------------------------------------------
-- 3. Public (client-callable) entry points.
-- ----------------------------------------------------------------------------
-- Per user. `p_bucket`, `p_max` and `p_window_seconds` are supplied by the
-- server caller; only the subject is derived from the JWT.
create or replace function public.check_rate_limit(
  p_bucket         text,
  p_max            integer,
  p_window_seconds integer
)
returns table (allowed boolean, remaining integer, retry_after integer)
language sql
security definer
set search_path = public
as $$
  select *
    from public.rate_limit_hit(
      'user:' || coalesce(auth.uid()::text, 'anon'),
      p_bucket, p_max, p_window_seconds);
$$;

-- Per IP. The raw address is hashed before it is stored.
create or replace function public.check_rate_limit_ip(
  p_bucket         text,
  p_ip             text,
  p_max            integer,
  p_window_seconds integer
)
returns table (allowed boolean, remaining integer, retry_after integer)
language sql
security definer
set search_path = public
as $$
  select *
    from public.rate_limit_hit(
      'ip:' || md5(coalesce(nullif(p_ip, ''), 'unknown')),
      p_bucket, p_max, p_window_seconds);
$$;

-- The core function stays private; only the two wrappers are executable, and
-- only by signed-in users (the IP wrapper also for anon, for the auth callback).
revoke all on function public.rate_limit_hit(text, text, integer, integer)
  from public, anon, authenticated;
revoke all on function public.check_rate_limit(text, integer, integer)
  from public, anon;
revoke all on function public.check_rate_limit_ip(text, text, integer, integer)
  from public;
grant execute on function public.check_rate_limit(text, integer, integer)
  to authenticated;
grant execute on function public.check_rate_limit_ip(text, text, integer, integer)
  to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. Housekeeping: drop windows older than a day. Call periodically (e.g. from
--    a Supabase scheduled job: select public.rate_limits_prune();).
-- ----------------------------------------------------------------------------
create or replace function public.rate_limits_prune()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.rate_limits where window_start < now() - interval '1 day';
$$;

revoke all on function public.rate_limits_prune() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5. Database-level guard for team-chat messages (20 / minute per sender).
--    If you already have an equivalent trigger on employee_messages, remove
--    this one so messages are not double-counted.
-- ----------------------------------------------------------------------------
create or replace function public.enforce_employee_message_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allowed boolean;
  v_retry   integer;
begin
  -- Service-role / SQL-editor writes have no JWT: leave them untouched.
  if auth.uid() is null then
    return new;
  end if;

  select r.allowed, r.retry_after
    into v_allowed, v_retry
    from public.rate_limit_hit(
      'user:' || auth.uid()::text,
      'employee_messages:send', 20, 60) r;

  if not v_allowed then
    raise exception 'RATE_LIMIT'
      using errcode = 'P0001', hint = v_retry::text;
  end if;

  return new;
end $$;

do $$
begin
  if to_regclass('public.employee_messages') is not null
     and not exists (
       select 1 from pg_trigger
        where tgname = 'employee_messages_rate_limit'
          and tgrelid = 'public.employee_messages'::regclass)
  then
    create trigger employee_messages_rate_limit
      before insert on public.employee_messages
      for each row execute function public.enforce_employee_message_rate_limit();
  end if;
end $$;

-- ============================================================================
-- Done. Next: supabase/audit/inventory.sql, then supabase/tests/security_tests.sql.
-- ============================================================================
