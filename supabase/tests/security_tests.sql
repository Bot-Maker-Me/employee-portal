-- ============================================================================
-- supabase/tests/security_tests.sql
-- ----------------------------------------------------------------------------
-- Row Level Security + privilege-escalation tests.
--
-- RUN THIS ON A STAGING/DEV PROJECT. It only ever *attempts* writes that are
-- expected to be rejected; if a control is missing the offending statement runs
-- for real, so do not point it at production.
--
-- It impersonates users exactly the way PostgREST/Supabase does: by switching
-- to the `authenticated`/`anon` role and setting the JWT claims that `auth.uid()`
-- reads. Every assertion that fails raises an exception with a "FAIL:" prefix,
-- so a clean run prints only the final NOTICE.
-- ============================================================================

do $$
declare
  a            uuid;
  b            uuid;
  n            integer;
  blocked      boolean;
  claims_for   text;
begin
  select id into a from public.profiles where status = 'active' order by id limit 1;
  select id into b from public.profiles where id <> a order by id limit 1;

  if a is null or b is null then
    raise notice 'security_tests: need at least 2 profiles (one active). SKIPPED.';
    return;
  end if;

  claims_for := json_build_object('sub', a, 'role', 'authenticated')::text;

  -- ------------------------------------------------------------------------
  -- USER A
  -- ------------------------------------------------------------------------
  perform set_config('request.jwt.claims', claims_for, true);
  perform set_config('request.jwt.claim.sub', a::text, true);
  execute 'set local role authenticated';

  -- A reads their own profile.
  select count(*) into n from public.profiles where id = a;
  if n <> 1 then
    raise exception 'FAIL: user A cannot read their own profile';
  end if;

  -- A must NOT read user B's profile.
  select count(*) into n from public.profiles where id = b;
  if n <> 0 then
    raise exception 'FAIL: user A can read user B''s profile (% rows)', n;
  end if;

  -- A must NOT read user B's push subscriptions.
  select count(*) into n from public.push_subscriptions where user_id = b;
  if n <> 0 then
    raise exception 'FAIL: user A can read user B''s push subscriptions';
  end if;

  execute 'reset role';

  -- ------------------------------------------------------------------------
  -- USER A: privilege escalation attempts (all must fail)
  -- ------------------------------------------------------------------------
  perform set_config('request.jwt.claims', claims_for, true);
  perform set_config('request.jwt.claim.sub', a::text, true);
  execute 'set local role authenticated';

  blocked := false;
  begin
    update public.profiles set role = 'super_admin' where id = a;
  exception when others then blocked := true;
  end;
  if not blocked then
    raise exception 'FAIL: user A escalated their own role to super_admin';
  end if;

  blocked := false;
  begin
    update public.profiles set status = 'active', organization = 'attacker-org' where id = a;
  exception when others then blocked := true;
  end;
  if not blocked then
    raise exception 'FAIL: user A changed their own status/organization';
  end if;

  blocked := false;
  begin
    insert into public.push_subscriptions (user_id, endpoint)
    values (b, 'test://should-not-exist');
  exception when others then blocked := true;
  end;
  if not blocked then
    raise exception 'FAIL: user A created a push subscription for user B';
  end if;

  -- A must not be able to delete their own profile row.
  blocked := false;
  begin
    delete from public.profiles where id = a;
  exception when others then blocked := true;
  end;
  if not blocked then
    raise exception 'FAIL: user A deleted their own profile row';
  end if;

  execute 'reset role';

  -- ------------------------------------------------------------------------
  -- ANON: no access to any user-data table
  -- ------------------------------------------------------------------------
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'set local role anon';

  n := 0;
  begin
    select count(*) into n from public.profiles;
  exception when others then n := 0;
  end;
  if n <> 0 then
    raise exception 'FAIL: anon can read profiles (% rows)', n;
  end if;

  n := 0;
  begin
    select count(*) into n from public.push_subscriptions;
  exception when others then n := 0;
  end;
  if n <> 0 then
    raise exception 'FAIL: anon can read push_subscriptions (% rows)', n;
  end if;

  execute 'reset role';

  raise notice 'security_tests: ALL PASSED';
end $$;
