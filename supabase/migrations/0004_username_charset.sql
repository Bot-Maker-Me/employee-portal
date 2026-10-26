-- ============================================================================
-- 0004_username_charset.sql
-- ----------------------------------------------------------------------------
-- Relaxes the username character set for the Employee Portal.
--
-- WHY: administrators asked to type a person's username the way they would
-- write it — "Sherif Youssef", "Sherif.Youssef", "O'Brien" — instead of being
-- limited to letters, numbers, dot, underscore and hyphen.
--
-- WHAT CHANGES: only the CHECK constraint on public.profiles.username. No
-- column, row, index, policy or other app is touched, and usernames are still
-- stored LOWERCASE (the app lowercases and collapses whitespace before every
-- write and every lookup), so the existing unique index on lower(username) and
-- the sibling apps' email sign-in are unaffected.
--
-- Allowed now: letters, numbers, space, dot, underscore, hyphen, apostrophe.
-- Length is unchanged: 3-32 characters. Every username already in the table
-- satisfies the new rule, so this cannot fail on existing data.
--
-- Idempotent: safe to run more than once.
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'profiles'
       and column_name = 'username'
  ) then
    raise notice 'profiles.username is missing — run 0003_username_login.sql first';
    return;
  end if;

  alter table public.profiles
    drop constraint if exists profiles_username_format_chk;

  alter table public.profiles
    add constraint profiles_username_format_chk
    check (username is null or username ~ $usr$^[a-z0-9 ._'-]{3,32}$usr$);
end $$;

comment on constraint profiles_username_format_chk on public.profiles is
  'Lowercase 3-32 chars: letters, numbers, space, dot, underscore, hyphen, apostrophe.';

-- ----------------------------------------------------------------------------
-- Verification (read-only). Expect one row with the relaxed pattern
-- (letters, numbers, space, dot, underscore, hyphen, apostrophe).
-- ----------------------------------------------------------------------------
select conname, pg_get_constraintdef(oid) as definition
  from pg_constraint
 where conrelid = 'public.profiles'::regclass
   and conname = 'profiles_username_format_chk';

-- And how the existing usernames look now (nothing should need fixing).
select count(*) filter (where username is not null) as with_username,
       count(*) filter (where username is null)     as without_username
  from public.profiles;
