-- ============================================================================
-- sql/username_backfill.sql
-- ----------------------------------------------------------------------------
-- RUN ONLY AFTER you have reviewed sql/username_review.sql and fixed the
-- clashes by hand (via the admin "Set username" action in the Employee Portal).
--
-- What it does: fills profiles.username for accounts that
--   * still have no username, and
--   * get a valid suggestion (3-32 chars, [a-z0-9._-], not the placeholder
--     domain), and
--   * do not collide with another suggestion, an existing username or the
--     reserved list.
-- Nothing else is touched: emails, passwords, roles and status are unchanged, so
-- the sibling apps that sign in by email keep working exactly as before.
--
-- STEP 1 — dry run (SELECT only). Confirm the row count and the list, then run
--          STEP 2. Re-running STEP 2 is safe: it only fills NULL usernames.
-- ============================================================================

-- STEP 1: DRY RUN ------------------------------------------------------------
with settings as (
  select
    'employees.internal'::text as placeholder_domain,
    array['admin', 'administrator', 'root', 'support', 'system']::text[] as reserved
),
src as (
  select
    p.id,
    p.email,
    p.username,
    case
      when p.email is null then null
      when split_part(lower(p.email), '@', 2) = (select placeholder_domain from settings) then null
      else nullif(
        left(regexp_replace(lower(split_part(coalesce(p.email, ''), '@', 1)), '[^a-z0-9._-]', '', 'g'), 32),
        ''
      )
    end as raw_candidate
  from public.profiles p
),
cand as (
  select s.*,
         case when length(coalesce(s.raw_candidate, '')) >= 3 then s.raw_candidate end as candidate
    from src s
),
candidates as (
  select id, email, candidate
    from cand
   where username is null
     and candidate is not null
     and candidate <> all (select unnest(reserved) from settings)
     and not exists (
       select 1 from public.profiles x
        where x.username is not null and lower(x.username) = cand.candidate
     )
),
unique_candidates as (
  select candidate from candidates group by candidate having count(*) = 1
)
select c.id, c.email, c.candidate as username_to_set
  from candidates c
  join unique_candidates u on u.candidate = c.candidate
 order by c.candidate;

-- STEP 2: BACKFILL (run only after STEP 1 looks right) -----------------------
begin;

with settings as (
  select
    'employees.internal'::text as placeholder_domain,
    array['admin', 'administrator', 'root', 'support', 'system']::text[] as reserved
),
src as (
  select
    p.id,
    p.email,
    p.username,
    case
      when p.email is null then null
      when split_part(lower(p.email), '@', 2) = (select placeholder_domain from settings) then null
      else nullif(
        left(regexp_replace(lower(split_part(coalesce(p.email, ''), '@', 1)), '[^a-z0-9._-]', '', 'g'), 32),
        ''
      )
    end as raw_candidate
  from public.profiles p
),
cand as (
  select s.*,
         case when length(coalesce(s.raw_candidate, '')) >= 3 then s.raw_candidate end as candidate
    from src s
),
candidates as (
  select id, email, candidate
    from cand
   where username is null
     and candidate is not null
     and candidate <> all (select unnest(reserved) from settings)
     and not exists (
       select 1 from public.profiles x
        where x.username is not null and lower(x.username) = cand.candidate
     )
),
unique_candidates as (
  select candidate from candidates group by candidate having count(*) = 1
)
update public.profiles p
   set username = c.candidate
  from candidates c
  join unique_candidates u on u.candidate = c.candidate
 where p.id = c.id
   and p.username is null;

-- Expect: one row, filled = number of accounts that just gained a username.
select count(*) filter (where username is not null) as with_username,
       count(*) filter (where username is null)     as still_without_username
  from public.profiles;

-- Look at what was filled, then COMMIT (or ROLLBACK if anything surprises you).
select id, email, username, role, status, organization
  from public.profiles
 where username is not null
 order by username;

commit;
-- rollback;
