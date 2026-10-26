-- ============================================================================
-- sql/username_review.sql
-- ----------------------------------------------------------------------------
-- READ-ONLY. Run this in the shared Supabase SQL editor AFTER
-- supabase/migrations/0003_username_login.sql and BEFORE any backfill.
--
-- It lists every account that has an email with:
--   suggested_username        the local part of the email, lowercased, cleaned
--                             to [a-z0-9._-] and trimmed to 32 chars
--   suggestion_count          how many accounts would end up with that username
--   clashes_with_existing     the suggestion is already taken by a set username
--   duplicate_or_taken        ⇒ you MUST fix these by hand (see below)
--   needs_manual_username     no usable suggestion (too short / placeholder /
--                             no email) ⇒ use the admin "Set username" action
--   safe_to_backfill          true only for rows the backfill script will fill
--
-- Nothing here writes. Edit the two settings below, then run.
-- ============================================================================

with settings as (
  select
    -- EDIT ME: the value of the PLACEHOLDER_EMAIL_DOMAIN server env var.
    'employees.internal'::text  as placeholder_domain,
    -- EDIT ME: usernames reserved for the app itself.
    array['admin', 'administrator', 'root', 'support', 'system']::text[] as reserved
),
src as (
  select
    p.id,
    p.email,
    p.username,
    p.full_name,
    p.role,
    p.status,
    p.organization,
    (
      p.email is not null
      and split_part(lower(p.email), '@', 2) = (select placeholder_domain from settings)
    ) as is_placeholder,
    nullif(
      left(regexp_replace(lower(split_part(coalesce(p.email, ''), '@', 1)), '[^a-z0-9._-]', '', 'g'), 32),
      ''
    ) as raw_candidate
  from public.profiles p
),
cand as (
  select
    s.*,
    case
      when s.is_placeholder then null
      when length(coalesce(s.raw_candidate, '')) >= 3 then s.raw_candidate
    end as candidate
  from src s
),
taken as (
  select lower(username) as username
    from public.profiles
   where username is not null
),
scored as (
  select
    c.*,
    (select count(*) from cand c2
      where c2.candidate is not null and c2.candidate = c.candidate) as suggestion_count,
    (
      c.candidate is not null
      and exists (select 1 from taken t where t.username = c.candidate)
    ) as clashes_with_existing,
    (
      c.candidate is not null
      and c.candidate = any (select unnest(reserved) from settings)
    ) as clashes_with_reserved
  from cand c
)
select
  id,
  email,
  full_name,
  role,
  status,
  organization,
  username                       as existing_username,
  candidate                      as suggested_username,
  suggestion_count,
  (suggestion_count > 1)         as duplicate_suggestion,
  clashes_with_existing,
  clashes_with_reserved,
  (suggestion_count > 1 or clashes_with_existing or clashes_with_reserved) as duplicate_or_taken,
  (candidate is null)            as needs_manual_username,
  (
    username is null
    and candidate is not null
    and suggestion_count = 1
    and not clashes_with_existing
    and not clashes_with_reserved
  ) as safe_to_backfill
from scored
order by
  duplicate_or_taken desc,
  needs_manual_username desc,
  suggested_username nulls last,
  email;

-- ----------------------------------------------------------------------------
-- How to fix the clashes (do this by hand, no SQL needed for the fix-up):
--   * duplicate_suggestion = true  → keep the first person's username and give
--     the others a different one (e.g. add a middle initial or a number) with
--     the admin "Set username" action in the Employee Portal.
--   * clashes_with_existing = true → whoever already owns it keeps it.
--   * needs_manual_username = true → use the admin "Set username" action.
-- Only rows with safe_to_backfill = true are filled by sql/username_backfill.sql.
-- ----------------------------------------------------------------------------
