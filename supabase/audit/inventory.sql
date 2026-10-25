-- ============================================================================
-- supabase/audit/inventory.sql
-- ----------------------------------------------------------------------------
-- Read-only diagnostics. Run each section in the Supabase SQL editor and act on
-- the rows it returns. These queries mirror the checks the Supabase Security
-- and Performance Advisors perform, but let you see them alongside the app's
-- exact objects. Nothing here writes.
-- ============================================================================

-- 1. Tables in `public` that still have RLS DISABLED -------------------------
select c.relname as table
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public'
   and c.relkind = 'r'
   and c.relrowsecurity = false
 order by 1;

-- 2. Tables with RLS enabled but NO policies (deny-all; intentionally OK only
--    for the private counter table `rate_limits`) ---------------------------
select c.relname as table
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public'
   and c.relkind = 'r'
   and c.relrowsecurity = true
   and not exists (
     select 1 from pg_policies p
      where p.schemaname = 'public' and p.tablename = c.relname)
 order by 1;

-- 3. Always-true policies (the "USING (true)" smell). `organizations` and
--    `features` are deliberately public READ-ONLY — everything else here is a
--    finding. ---------------------------------------------------------------
select tablename, policyname, cmd, roles::text, qual, with_check
  from pg_policies
 where schemaname = 'public'
   and (qual = 'true' or with_check = 'true')
 order by tablename, policyname;

-- 4. Policies that are not restricted to a role (roles = {public}) -----------
select tablename, policyname, cmd, roles::text, qual
  from pg_policies
 where schemaname = 'public'
   and roles::text = '{public}'
 order by tablename, policyname;

-- 5. Views that do NOT run with security_invoker --------------------------
select n.nspname as schema, c.relname as view,
       coalesce(array_to_string(c.reloptions, ', '), '(default)') as options
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public'
   and c.relkind = 'v'
   and (c.reloptions is null or not (c.reloptions::text like '%security_invoker=true%'))
 order by 1, 2;

-- 6. SECURITY DEFINER functions without a pinned search_path ---------------
select n.nspname as schema, p.proname as function,
       coalesce(array_to_string(p.proconfig, ', '), '(none)') as settings
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.prosecdef = true
   and (p.proconfig is null or not exists (
     select 1 from unnest(p.proconfig) s where s like 'search_path=%'))
 order by 1, 2;

-- 7. Columns that look privileged but may be writable by `authenticated` -----
--    (privilege-escalation surface). Expect role/status/organization/etc. to be
--    absent from "writable_columns" for profiles.
select table_name, column_name,
       bool_or(privilege_type = 'UPDATE') as update_privilege
  from information_schema.column_privileges
 where table_schema = 'public'
   and grantee in ('anon', 'authenticated')
   and column_name in (
     'role', 'status', 'organization', 'is_admin', 'is_premium', 'tier',
     'credits', 'usage_limit', 'pharmacy_id', 'home_id')
 group by table_name, column_name
 order by table_name, column_name;

-- 8. Foreign-key columns without a supporting index (Performance Advisor) ----
select c.conrelid::regclass as table, a.attname as column
  from pg_constraint c
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
 where c.contype = 'f'
   and c.connamespace = 'public'::regnamespace
   and not exists (
     select 1
       from pg_index i
      where i.indrelid = c.conrelid
        and a.attnum = any (i.indkey))
 order by 1, 2;

-- 9. Grant of table privileges to anon (should be empty except for the public
--    read-only registries) ---------------------------------------------------
select table_name, privilege_type
  from information_schema.role_table_grants
 where table_schema = 'public'
   and grantee = 'anon'
 order by table_name, privilege_type;
