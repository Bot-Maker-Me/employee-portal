-- ============================================================================
-- sql/username_setup.sql
-- ----------------------------------------------------------------------------
-- ONE-SHOT username setup for the Employee Portal.
--
-- Run AFTER supabase/migrations/0003_username_login.sql, in the shared Supabase
-- SQL editor: paste this whole file and press Run. Nothing has to be edited
-- except the two settings in the block marked EDIT ME (only if they differ).
--
-- It ONLY fills public.profiles.username where it is currently NULL. Emails,
-- passwords, roles and status are never touched, so the sibling apps that sign
-- in with email + password keep working exactly as before. Safe to re-run.
--
-- Steps — each one prints its own result:
--   A. Who already has a username, and who has to be set by hand.
--   B. Assign usernames (derived from the email local part).
--   C. The final list of usernames to hand out.
--
-- If two accounts would get the same username, the first (by email order) keeps
-- it and the next one gets a numeric suffix (e.g. jsmith2). Change any of them
-- later from Admin → Users → "Set username".
--
-- (sql/username_review.sql + sql/username_backfill.sql remain available if you
--  prefer to review every clash by hand and fill nothing automatically.)
-- ============================================================================

-- EDIT ME (one place only) ---------------------------------------------------
drop table if exists pg_temp.username_setup_settings;
create table pg_temp.username_setup_settings (
  placeholder_domain text   not null,
  reserved           text[] not null
);
insert into pg_temp.username_setup_settings
values ('employees.internal', array['admin', 'administrator', 'root', 'support', 'system']);
-- ----------------------------------------------------------------------------

-- A1. ALREADY SET — nothing below will change these.
select 'already set' as state,
       p.id, p.username, p.email, p.full_name, p.role, p.organization
  from public.profiles p
 where p.username is not null
 order by p.username;

-- A2. CANNOT BE SET AUTOMATICALLY — give these a username by hand
--     (Admin → Users → "Set username"). No email, a hidden placeholder
--     address, or a local part with no usable characters.
select 'set by hand' as state,
       p.id, p.email, p.full_name, p.role, p.organization
  from public.profiles p
 where p.username is null
   and (
     p.email is null
     or split_part(lower(p.email), '@', 2) = (select placeholder_domain from pg_temp.username_setup_settings)
     or nullif(left(regexp_replace(split_part(lower(p.email), '@', 1), '[^a-z0-9._-]', '', 'g'), 28), '') is null
   )
 order by p.email;

-- B. ASSIGN ------------------------------------------------------------------
-- Fills username where it is NULL: email local part, lowercased, cleaned to
-- [a-z0-9._-], max 28 chars, with a numeric suffix when the name is taken.
drop table if exists pg_temp.username_setup_assigned;
create table pg_temp.username_setup_assigned (
  username     text,
  email        text,
  full_name    text,
  role         text,
  organization text
);

do $$
declare
  v_domain   text;
  v_reserved text[];
  r          record;
  base       text;
  candidate  text;
  n          int;
  ok         boolean;
  filled     int := 0;
begin
  select placeholder_domain, reserved into v_domain, v_reserved
    from pg_temp.username_setup_settings;

  for r in
    select p.id,
           lower(p.email) as email,
           p.full_name,
           p.role,
           p.organization,
           nullif(left(regexp_replace(split_part(lower(p.email), '@', 1), '[^a-z0-9._-]', '', 'g'), 28), '') as base
      from public.profiles p
     where p.username is null
       and p.email is not null
       and split_part(lower(p.email), '@', 2) <> v_domain
     order by lower(p.email)
  loop
    base := r.base;
    continue when base is null;

    candidate := null;
    ok := false;
    n := 1;
    loop
      exit when n > 999;
      candidate := case when n = 1 then base else left(base, 28) || n::text end;
      if length(candidate) >= 3
         and not (candidate = any (v_reserved))
         and not exists (
              select 1 from public.profiles x
               where x.username is not null and lower(x.username) = candidate
            )
      then
        ok := true;
        exit;
      end if;
      n := n + 1;
    end loop;

    if not ok then
      raise notice 'no free username for %', r.email;
      continue;
    end if;

    update public.profiles p
       set username = candidate
     where p.id = r.id
       and p.username is null;

    insert into pg_temp.username_setup_assigned (username, email, full_name, role, organization)
    values (candidate, r.email, r.full_name, r.role, r.organization);

    filled := filled + 1;
  end loop;

  raise notice 'usernames assigned: %', filled;
end $$;

-- C. RESULT ------------------------------------------------------------------
-- The list to hand out (sign-in is username + password). Anything listed in A2
-- still needs a username by hand.
select username, email, full_name, role, organization
  from pg_temp.username_setup_assigned
 order by username;

select count(*) filter (where username is not null) as with_username,
       count(*) filter (where username is null)     as still_without_username
  from public.profiles;
