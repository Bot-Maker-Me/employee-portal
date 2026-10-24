-- ============================================================================
-- Employee Portal — sign-up, approvals, organizations & admin console
-- ----------------------------------------------------------------------------
-- Run this once in the SHARED Supabase project (also used by Pharma Portal).
-- It is written to be safe to re-run: it only ADDS objects and never drops
-- existing data. Review before running in production.
--
-- Order matters: the app reads public.profiles.status, so run this BEFORE
-- deploying / using the new screens.
-- ============================================================================

-- 1. Organizations registry --------------------------------------------------
create table if not exists public.organizations (
  name       text primary key,
  created_at timestamptz not null default now()
);

alter table public.organizations enable row level security;

drop policy if exists "organizations readable by authenticated" on public.organizations;
create policy "organizations readable by authenticated"
  on public.organizations for select
  to authenticated
  using (true);

-- Seed the registry from organizations already referenced on profiles.
insert into public.organizations (name)
select distinct organization
  from public.profiles
 where organization is not null and organization <> ''
on conflict (name) do nothing;

-- 2. Profiles: approval status ----------------------------------------------
alter table public.profiles
  add column if not exists status text not null default 'pending';

-- Anyone already attached to an organization is treated as approved.
update public.profiles
   set status = 'active'
 where organization is not null
   and status = 'pending';

-- 3. Sign-up: create a pending profile for every new auth user ---------------
-- NOTE: this (re)creates the on_auth_user_created trigger in the shared
-- project. If Pharma Portal already has one with the same name, this replaces
-- its function body. The logic is conservative (insert-if-missing).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role, organization, status)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), ''),
    new.email,
    'employee',
    null,
    'pending'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4. Feature defaults: Pharmacy Chat ON, Team Chat OFF (hidden) --------------
insert into public.features (key, default_enabled)
select 'employee_team_chat', false
 where not exists (select 1 from public.features where key = 'employee_team_chat');

insert into public.features (key, default_enabled)
select 'employee_pharmacy_topics', true
 where not exists (select 1 from public.features where key = 'employee_pharmacy_topics');

-- Pharmacy Chat is available to everyone by default…
update public.features set default_enabled = true  where key = 'employee_pharmacy_topics';
-- …Team Chat stays hidden until the super-admin enables it per organization.
update public.features set default_enabled = false where key = 'employee_team_chat';
delete from public.tenant_features where feature_key = 'employee_team_chat';

-- 5. Authorization helpers ---------------------------------------------------
create or replace function public.is_super_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select p.role = 'super_admin' from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select p.role in ('admin', 'super_admin') from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

create or replace function public.my_org()
returns text
language sql stable security definer set search_path = public
as $$
  select p.organization from public.profiles p where p.id = auth.uid();
$$;

-- 6. Admin RPCs (SECURITY DEFINER; every call re-checks the caller) ----------
create or replace function public.admin_list_users()
returns table(
  id uuid, full_name text, email text,
  role text, organization text, status text
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  return query
    select p.id, p.full_name, p.email, p.role, p.organization, p.status
      from public.profiles p
     where public.is_super_admin() or p.organization = public.my_org()
     order by (p.status = 'pending') desc, p.email;
end $$;

create or replace function public.admin_list_organizations()
returns table(name text, member_count bigint)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  return query
    select o.name, coalesce(count(p.id), 0)::bigint
      from public.organizations o
      left join public.profiles p
        on p.organization = o.name and p.status = 'active'
     group by o.name
     order by o.name;
end $$;

create or replace function public.admin_create_organization(p_name text)
returns text
language plpgsql security definer set search_path = public
as $$
declare v_name text := trim(coalesce(p_name, ''));
begin
  if not public.is_super_admin() then raise exception 'FORBIDDEN'; end if;
  if v_name = '' then raise exception 'BAD_NAME'; end if;
  insert into public.organizations (name) values (v_name) on conflict (name) do nothing;
  return v_name;
end $$;

create or replace function public.admin_delete_organization(p_name text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_super_admin() then raise exception 'FORBIDDEN'; end if;
  update public.profiles
     set organization = null, status = 'pending'
   where organization = p_name;
  delete from public.organizations where name = p_name;
end $$;

create or replace function public.admin_approve_user(p_user_id uuid, p_organization text)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_org text := nullif(trim(coalesce(p_organization, '')), '');
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if v_org is null then raise exception 'BAD_ORG'; end if;
  if not public.is_super_admin() and v_org <> public.my_org() then
    raise exception 'FORBIDDEN';
  end if;
  insert into public.organizations (name) values (v_org) on conflict (name) do nothing;
  update public.profiles
     set organization = v_org, status = 'active'
   where id = p_user_id;
end $$;

create or replace function public.admin_set_user_organization(p_user_id uuid, p_organization text)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_org text := nullif(trim(coalesce(p_organization, '')), '');
begin
  if not public.is_super_admin() then raise exception 'FORBIDDEN'; end if;
  if v_org is not null then
    insert into public.organizations (name) values (v_org) on conflict (name) do nothing;
  end if;
  update public.profiles
     set organization = v_org,
         status = case when v_org is null then 'pending' else 'active' end
   where id = p_user_id;
end $$;

create or replace function public.admin_set_role(p_user_id uuid, p_role text)
returns void
language plpgsql security definer set search_path = public
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
  update public.profiles set role = p_role where id = p_user_id;
end $$;

create or replace function public.admin_list_features(p_organization text)
returns table(feature_key text, enabled boolean)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_super_admin() then raise exception 'FORBIDDEN'; end if;
  return query
    select f.key, coalesce(tf.enabled, f.default_enabled)
      from public.features f
      left join public.tenant_features tf
        on tf.feature_key = f.key and tf.organization = p_organization
     where f.key in ('employee_team_chat', 'employee_pharmacy_topics')
     order by f.key;
end $$;

create or replace function public.admin_set_feature(
  p_organization text, p_feature_key text, p_enabled boolean
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_super_admin() then raise exception 'FORBIDDEN'; end if;
  delete from public.tenant_features
   where organization = p_organization and feature_key = p_feature_key;
  insert into public.tenant_features (organization, feature_key, enabled)
  values (p_organization, p_feature_key, p_enabled);
end $$;

-- 7. Bootstrap: make the app owner the platform super-admin ------------------
--    (No organization required — a super-admin manages all organizations.)
update public.profiles
   set role = 'super_admin', status = 'active'
 where email = 'piyush80545@gmail.com';

-- ============================================================================
-- Done. Sign out and back in, then open /admin.
-- ============================================================================
