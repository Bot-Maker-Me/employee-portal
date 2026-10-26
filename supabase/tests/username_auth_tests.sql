-- ============================================================================
-- supabase/tests/username_auth_tests.sql
-- ----------------------------------------------------------------------------
-- Database-level tests for the username sign-in layer (migration 0003).
--
-- RUN THIS ON A STAGING/DEV PROJECT. It impersonates users the same way
-- PostgREST does (switching to `authenticated` and setting the JWT claims that
-- `auth.uid()` reads) and attempts writes that MUST be rejected. Every failed
-- assertion raises an exception prefixed with "FAIL:".
--
-- The end-to-end browser tests (wrong password, lockout, forced password
-- change, …) are described in the delivery notes; they cannot be expressed in
-- SQL because the email lookup and password verification happen in the GoTrue
-- API with the service role key.
--
-- Run the whole file in one transaction and ROLLBACK at the end: a missing
-- control would otherwise leave the probe values behind.
-- ============================================================================

begin;

do $$
declare
  employee_id  uuid;
  admin_id     uuid;
  n            integer;
  blocked      boolean;
  claims_for   text;
begin
  -- ------------------------------------------------------------------------
  -- 1. Structure: new columns / tables / index exist and RLS is on.
  -- ------------------------------------------------------------------------
  select count(*) into n
    from information_schema.columns
   where table_schema = 'public' and table_name = 'profiles'
     and column_name in ('username', 'must_change_password');
  if n <> 2 then
    raise exception 'FAIL: profiles is missing username / must_change_password';
  end if;

  select count(*) into n
    from pg_class c
    join pg_namespace ns on ns.oid = c.relnamespace
   where ns.nspname = 'public'
     and c.relname in ('app_user_status', 'password_reset_requests', 'login_attempts', 'auth_audit_log')
     and c.relkind = 'r'
     and c.relrowsecurity;
  if n <> 4 then
    raise exception 'FAIL: expected 4 username-auth tables with RLS enabled, found %', n;
  end if;

  select count(*) into n
    from pg_indexes
   where schemaname = 'public' and tablename = 'profiles'
     and indexdef ilike '%lower(username)%';
  if n < 1 then
    raise exception 'FAIL: profiles has no case-insensitive unique index on username';
  end if;

  -- ------------------------------------------------------------------------
  -- 2. profiles.username rejects usernames that break the app's contract.
  -- ------------------------------------------------------------------------
  select id into employee_id from public.profiles order by id limit 1;
  if employee_id is null then
    raise notice 'username_auth_tests: no profiles yet. SKIPPED.';
    return;
  end if;

  blocked := false;
  begin
    update public.profiles set username = 'ab' where id = employee_id;
  exception when others then blocked := true;
  end;
  if not blocked then
    raise exception 'FAIL: a 2-character username was accepted';
  end if;

  blocked := false;
  begin
    update public.profiles set username = 'Bad Name!' where id = employee_id;
  exception when others then blocked := true;
  end;
  if not blocked then
    raise exception 'FAIL: a username with spaces/punctuation was accepted';
  end if;

  -- ------------------------------------------------------------------------
  -- 3. A rank-and-file user gets no read or write access to the new tables.
  -- ------------------------------------------------------------------------
  select id into employee_id
    from public.profiles
   where role = 'employee'
   order by id limit 1;

  if employee_id is null then
    raise notice 'username_auth_tests: no employee profile to impersonate. SKIPPED read tests.';
  else
    claims_for := json_build_object('sub', employee_id, 'role', 'authenticated')::text;
    perform set_config('request.jwt.claims', claims_for, true);
    perform set_config('request.jwt.claim.sub', employee_id::text, true);
    execute 'set local role authenticated';

    -- Reads: either denied outright or filtered to zero rows. Never data.
    n := 0;
    begin
      select count(*) into n from public.app_user_status;
    exception when others then n := 0;
    end;
    if n <> 0 then
      raise exception 'FAIL: an employee can read app_user_status (% rows)', n;
    end if;

    n := 0;
    begin
      select count(*) into n from public.password_reset_requests;
    exception when others then n := 0;
    end;
    if n <> 0 then
      raise exception 'FAIL: an employee can read password_reset_requests (% rows)', n;
    end if;

    n := 0;
    begin
      select count(*) into n from public.auth_audit_log;
    exception when others then n := 0;
    end;
    if n <> 0 then
      raise exception 'FAIL: an employee can read auth_audit_log (% rows)', n;
    end if;

    -- Writes: must all fail.
    blocked := false;
    begin
      insert into public.app_user_status (user_id, app_key, is_active)
      values (employee_id, 'employee_portal', false);
    exception when others then blocked := true;
    end;
    if not blocked then
      raise exception 'FAIL: an employee wrote their own app_user_status row';
    end if;

    blocked := false;
    begin
      insert into public.password_reset_requests (user_id, username)
      values (employee_id, 'self-service');
    exception when others then blocked := true;
    end;
    if not blocked then
      raise exception 'FAIL: an employee created a password_reset_requests row';
    end if;

    blocked := false;
    begin
      insert into public.login_attempts (username, success) values ('forged', true);
    exception when others then blocked := true;
    end;
    if not blocked then
      raise exception 'FAIL: an employee wrote to login_attempts';
    end if;

    blocked := false;
    begin
      insert into public.auth_audit_log (action) values ('password_changed');
    exception when others then blocked := true;
    end;
    if not blocked then
      raise exception 'FAIL: an employee wrote to auth_audit_log';
    end if;

    execute 'reset role';
  end if;

  -- ------------------------------------------------------------------------
  -- 4. An admin CAN read (the policies exist and grant a path).
  -- ------------------------------------------------------------------------
  select id into admin_id
    from public.profiles
   where role in ('admin', 'super_admin')
   order by role desc, id limit 1;

  if admin_id is null then
    raise notice 'username_auth_tests: no admin profile to impersonate. SKIPPED admin read test.';
  else
    claims_for := json_build_object('sub', admin_id, 'role', 'authenticated')::text;
    perform set_config('request.jwt.claims', claims_for, true);
    perform set_config('request.jwt.claim.sub', admin_id::text, true);
    execute 'set local role authenticated';

    begin
      select count(*) into n from public.password_reset_requests;
      select count(*) into n from public.app_user_status;
      select count(*) into n from public.auth_audit_log;
    exception when others then
      raise exception 'FAIL: an admin cannot read the username-auth tables';
    end;

    execute 'reset role';
  end if;

  -- ------------------------------------------------------------------------
  -- 5. anon: no access at all.
  -- ------------------------------------------------------------------------
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'set local role anon';

  n := 0;
  begin
    select count(*) into n from public.app_user_status;
  exception when others then n := 0;
  end;
  if n <> 0 then
    raise exception 'FAIL: anon can read app_user_status (% rows)', n;
  end if;

  execute 'reset role';

  raise notice 'username_auth_tests: ALL PASSED';
end $$;

-- Nothing here should persist. Comment this out only if you want to inspect the
-- rows a failing control managed to write.
rollback;
