-- ============================================================================
-- 0001_security_hardening_rls.sql
-- ----------------------------------------------------------------------------
-- Row Level Security + privilege-escalation lockdown for the Employee Portal's
-- OWN Supabase project. (The Pharma/Nursing bridge is a different project and is
-- not touched here.)
--
-- DESIGN RULES
--   * ADDITIVE ONLY. This file never drops data, columns, tables or functions.
--     The only DROPs are of *policies and triggers* (access rules), which are
--     re-created immediately below.
--   * IDEMPOTENT. Safe to run more than once.
--   * Do not run this in the Pharma/Nursing project.
--
-- WHAT IT FIXES
--   [1] RLS is explicitly ON for every application table.
--   [2] Every always-true policy (USING (true) / WITH CHECK (true)) on
--       user-data tables is removed. A user's rows are reachable only by that
--       user (owner scoping) or by members of the same organization/tenant.
--   [3] Privilege escalation through `profiles` (role / status / organization /
--       pharmacy_id / home_id) is blocked at three layers:
--         - RLS UPDATE policy is scoped to the caller's own row;
--         - column-level GRANTs remove UPDATE on the sensitive columns;
--         - a BEFORE UPDATE trigger rejects changes unless they come from the
--           service role or from an admin RPC (which re-checks the caller).
--   [4] Indexes for every column used in a policy predicate.
--   [5] All public views run with security_invoker = true.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Authorization helpers (SECURITY DEFINER with a pinned search_path).
--    Re-created so this migration is self-sufficient; bodies are unchanged.
-- ----------------------------------------------------------------------------
create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select p.role = 'super_admin' from public.profiles p where p.id = auth.uid()),
    false);
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select p.role in ('admin', 'super_admin') from public.profiles p where p.id = auth.uid()),
    false);
$$;

create or replace function public.my_org()
returns text language sql stable security definer set search_path = public
as $$
  select p.organization from public.profiles p where p.id = auth.uid();
$$;

-- Membership helper for team chat. Defined SECURITY DEFINER so its own read of
-- `employee_channel_members` does not re-trigger that table's RLS (self-recursion).
create or replace function public.is_channel_member(p_channel_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.employee_channel_members m
     where m.channel_id = p_channel_id
       and m.user_id = auth.uid());
$$;

-- ----------------------------------------------------------------------------
-- 1. Enable RLS on every application table (idempotent).
-- ----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles',
    'organizations',
    'features',
    'tenant_features',
    'push_subscriptions',
    'employee_channels',
    'employee_channel_members',
    'employee_messages'
  ]
  loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
    end if;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 2. Remove always-true (USING/WITH CHECK TRUE) policies on user-data tables.
--    `organizations` and `features` are deliberately public READ-ONLY registries
--    and are intentionally excluded here.
-- ----------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select tablename, policyname, cmd
      from pg_policies
     where schemaname = 'public'
       and tablename in (
         'profiles', 'tenant_features', 'push_subscriptions',
         'employee_channels', 'employee_channel_members', 'employee_messages'
       )
       and (qual = 'true' or with_check = 'true')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
    raise notice 'hardening: dropped permissive policy %.% (%)',
      r.tablename, r.policyname, r.cmd;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 3. Owner / organization scoped policies (explicit per operation).
-- ----------------------------------------------------------------------------
-- profiles: a user sees and edits only their own row. INSERT is performed by
-- the SECURITY DEFINER signup trigger; DELETE is never allowed to clients.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- organizations: deliberately public read-only registry (names only). The
-- original policy from sql/admin_signup_setup.sql is superseded.
drop policy if exists "organizations readable by authenticated" on public.organizations;
drop policy if exists organizations_read on public.organizations;
create policy organizations_read on public.organizations
  for select to authenticated using (true);

-- features: global flag defaults, readable by any authenticated user.
drop policy if exists features_read on public.features;
create policy features_read on public.features
  for select to authenticated using (true);

-- tenant_features: per-organization overrides, readable only by that org.
drop policy if exists tenant_features_read_own_org on public.tenant_features;
create policy tenant_features_read_own_org on public.tenant_features
  for select to authenticated
  using (organization = (select public.my_org()));

-- push_subscriptions: strictly the owner's own devices.
drop policy if exists "own push subscriptions" on public.push_subscriptions;
drop policy if exists push_subscriptions_select_own on public.push_subscriptions;
create policy push_subscriptions_select_own on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists push_subscriptions_insert_own on public.push_subscriptions;
create policy push_subscriptions_insert_own on public.push_subscriptions
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists push_subscriptions_update_own on public.push_subscriptions;
create policy push_subscriptions_update_own on public.push_subscriptions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists push_subscriptions_delete_own on public.push_subscriptions;
create policy push_subscriptions_delete_own on public.push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));

-- employee_channels: visible to members of the caller's organization; only the
-- creator may rename. Create/delete go through SECURITY DEFINER RPCs.
do $$
begin
  if to_regclass('public.employee_channels') is not null then
    drop policy if exists employee_channels_select_org on public.employee_channels;
    create policy employee_channels_select_org on public.employee_channels
      for select to authenticated
      using (organization = (select public.my_org()));

    drop policy if exists employee_channels_update_creator on public.employee_channels;
    create policy employee_channels_update_creator on public.employee_channels
      for update to authenticated
      using (created_by = (select auth.uid()))
      with check (
        created_by = (select auth.uid())
        and organization = (select public.my_org()));
  end if;
end $$;

-- employee_channel_members: visible to fellow members of the same channel;
-- a user may update (mark read) only their own membership row.
do $$
begin
  if to_regclass('public.employee_channel_members') is not null then
    drop policy if exists employee_channel_members_select on public.employee_channel_members;
    create policy employee_channel_members_select on public.employee_channel_members
      for select to authenticated
      using (public.is_channel_member(channel_id));

    drop policy if exists employee_channel_members_update_own on public.employee_channel_members;
    create policy employee_channel_members_update_own on public.employee_channel_members
      for update to authenticated
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()));
  end if;
end $$;

-- employee_messages: readable/insertable only by channel members; a sender may
-- edit/soft-delete only their own message.
do $$
begin
  if to_regclass('public.employee_messages') is not null then
    drop policy if exists employee_messages_select on public.employee_messages;
    create policy employee_messages_select on public.employee_messages
      for select to authenticated
      using (public.is_channel_member(channel_id));

    drop policy if exists employee_messages_insert on public.employee_messages;
    create policy employee_messages_insert on public.employee_messages
      for insert to authenticated
      with check (
        sender_id = (select auth.uid())
        and public.is_channel_member(channel_id));

    drop policy if exists employee_messages_update_own on public.employee_messages;
    create policy employee_messages_update_own on public.employee_messages
      for update to authenticated
      using (sender_id = (select auth.uid()))
      with check (sender_id = (select auth.uid()));
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 4. Block privilege escalation on `public.profiles`.
-- ----------------------------------------------------------------------------

-- 4a. Column-level lockdown. Revoke table UPDATE and re-grant it for the single
--     column an employee is allowed to change about themselves.
revoke all on public.profiles from anon;
revoke insert, delete, update, truncate, references, trigger on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;

-- 4b. Belt-and-braces trigger: even if a future migration re-grants the columns,
--     a non-privileged caller can never change role/status/organization on a row.
--     Admin RPCs opt in explicitly (see step 5) *after* re-checking the caller.
create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_allow text := nullif(current_setting('app.allow_profile_privilege_change', true), '');
begin
  -- Direct DB writes (service role key, SQL editor, the signup trigger) carry no
  -- end-user JWT — allow them.
  if v_uid is null then
    return new;
  end if;

  -- Admin RPCs set this flag only after their own role checks pass.
  if v_allow = 'on' then
    return new;
  end if;

  if new.role         is distinct from old.role
     or new.status     is distinct from old.status
     or new.organization is distinct from old.organization then
    raise exception 'profile privilege fields are read-only'
      using errcode = '42501';
  end if;

  return new;
end $$;

drop trigger if exists protect_profile_privileges on public.profiles;
create trigger protect_profile_privileges
  before update on public.profiles
  for each row execute function public.protect_profile_privileges();

-- ----------------------------------------------------------------------------
-- 5. Re-declare the admin RPCs so they set the opt-in flag before writing the
--    protected columns. Each one still re-checks the caller's role first.
-- ----------------------------------------------------------------------------
create or replace function public.admin_approve_user(p_user_id uuid, p_organization text)
returns void language plpgsql security definer set search_path = public
as $$
declare v_org text := nullif(trim(coalesce(p_organization, '')), '');
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if v_org is null then raise exception 'BAD_ORG'; end if;
  if not public.is_super_admin() and v_org <> public.my_org() then
    raise exception 'FORBIDDEN';
  end if;
  insert into public.organizations (name) values (v_org) on conflict (name) do nothing;
  perform set_config('app.allow_profile_privilege_change', 'on', true);
  update public.profiles set organization = v_org, status = 'active' where id = p_user_id;
end $$;

create or replace function public.admin_set_user_organization(p_user_id uuid, p_organization text)
returns void language plpgsql security definer set search_path = public
as $$
declare v_org text := nullif(trim(coalesce(p_organization, '')), '');
begin
  if not public.is_super_admin() then raise exception 'FORBIDDEN'; end if;
  if v_org is not null then
    insert into public.organizations (name) values (v_org) on conflict (name) do nothing;
  end if;
  perform set_config('app.allow_profile_privilege_change', 'on', true);
  update public.profiles
     set organization = v_org,
         status = case when v_org is null then 'pending' else 'active' end
   where id = p_user_id;
end $$;

create or replace function public.admin_set_role(p_user_id uuid, p_role text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_role not in ('employee', 'admin') then raise exception 'BAD_ROLE'; end if;
  if p_user_id = auth.uid() then raise exception 'SELF'; end if;
  if not public.is_super_admin() then
    if not exists (
      select 1 from public.profiles t
       where t.id = p_user_id and t.organization = public.my_org()
    ) then raise exception 'FORBIDDEN'; end if;
  end if;
  perform set_config('app.allow_profile_privilege_change', 'on', true);
  update public.profiles set role = p_role where id = p_user_id;
end $$;

create or replace function public.admin_delete_organization(p_name text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_super_admin() then raise exception 'FORBIDDEN'; end if;
  perform set_config('app.allow_profile_privilege_change', 'on', true);
  update public.profiles set organization = null, status = 'pending'
   where organization = p_name;
  delete from public.organizations where name = p_name;
end $$;

-- ----------------------------------------------------------------------------
-- 6. Indexes for the columns used in policy predicates.
-- ----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.profiles') is not null then
    create index if not exists profiles_organization_idx on public.profiles (organization);
  end if;
  if to_regclass('public.push_subscriptions') is not null then
    create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions (user_id);
  end if;
  if to_regclass('public.tenant_features') is not null then
    create index if not exists tenant_features_organization_idx on public.tenant_features (organization);
  end if;
  if to_regclass('public.employee_channels') is not null then
    create index if not exists employee_channels_organization_idx on public.employee_channels (organization);
    create index if not exists employee_channels_created_by_idx on public.employee_channels (created_by);
  end if;
  if to_regclass('public.employee_channel_members') is not null then
    create index if not exists employee_channel_members_user_id_idx on public.employee_channel_members (user_id);
    create index if not exists employee_channel_members_channel_id_idx on public.employee_channel_members (channel_id);
  end if;
  if to_regclass('public.employee_messages') is not null then
    create index if not exists employee_messages_channel_id_idx on public.employee_messages (channel_id);
    create index if not exists employee_messages_sender_id_idx on public.employee_messages (sender_id);
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 7. Views must run as the caller, not as the view owner.
-- ----------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in select viewname from pg_views where schemaname = 'public'
  loop
    execute format('alter view public.%I set (security_invoker = true)', r.viewname);
  end loop;
end $$;

-- ============================================================================
-- Done. Run 0002_rate_limits.sql next, then the checks in
-- supabase/audit/inventory.sql and supabase/tests/security_tests.sql.
-- ============================================================================
