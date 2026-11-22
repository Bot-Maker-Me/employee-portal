-- ===========================================================================
-- 0005 · Pharmacy sites, per-user pharmacy access, reference data
--
-- Adds the menu structure:
--   • Drug Database        (everyone in the organization)
--   • Intervention Codes   (everyone in the organization)
--   • One section per pharmacy (only staff an admin has given access to):
--       Notices & Reminders · Policies & Procedures · Chat with Pharmacy · Formulary
--
-- Additive and idempotent: new tables, helper functions and policies only.
-- Nothing existing is altered or dropped.
--
-- Access rule (enforced by RLS, not just the UI):
--   super_admin            → every pharmacy
--   admin                  → every pharmacy of their own organization
--   employee               → only pharmacies listed for them in pharmacy_access
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.portal_pharmacies (
  id               uuid primary key default gen_random_uuid(),
  organization     text not null references public.organizations(name)
                     on update cascade on delete cascade,
  slug             text not null check (slug ~ '^[a-z0-9-]{2,48}$'),
  name             text not null check (char_length(name) between 1 and 80),
  sort_order       int  not null default 0,
  -- Optional link to a `tenants.id` in the Pharma Portal project. When set,
  -- "Chat with Pharmacy" shows that tenant's threads.
  pharma_tenant_id uuid,
  created_at       timestamptz not null default now(),
  unique (organization, slug)
);

create table if not exists public.pharmacy_access (
  pharmacy_id uuid not null references public.portal_pharmacies(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  granted_by  uuid,
  granted_at  timestamptz not null default now(),
  primary key (pharmacy_id, user_id)
);
create index if not exists pharmacy_access_user_idx on public.pharmacy_access (user_id);

create table if not exists public.pharmacy_notices (
  id          uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.portal_pharmacies(id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 160),
  body        text not null default '' check (char_length(body) <= 8000),
  priority    text not null default 'normal' check (priority in ('normal', 'important', 'urgent')),
  pinned      boolean not null default false,
  remind_on   date,
  created_by  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists pharmacy_notices_pharmacy_idx
  on public.pharmacy_notices (pharmacy_id, pinned desc, created_at desc);

create table if not exists public.pharmacy_policies (
  id          uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.portal_pharmacies(id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 160),
  category    text not null default '' check (char_length(category) <= 60),
  body        text not null default '' check (char_length(body) <= 50000),
  link_url    text check (link_url is null or link_url ~ '^https?://'),
  created_by  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists pharmacy_policies_pharmacy_idx
  on public.pharmacy_policies (pharmacy_id, category, title);

create table if not exists public.pharmacy_formulary (
  id              uuid primary key default gen_random_uuid(),
  pharmacy_id     uuid not null references public.portal_pharmacies(id) on delete cascade,
  chemical_name   text not null check (char_length(chemical_name) between 1 and 200),
  preferred_brand text not null default '' check (char_length(preferred_brand) <= 200),
  preferred_din   text not null default '' check (char_length(preferred_din) <= 20),
  alternate_brand text not null default '' check (char_length(alternate_brand) <= 200),
  alternate_din   text not null default '' check (char_length(alternate_din) <= 20),
  notes           text not null default '' check (char_length(notes) <= 1000),
  updated_at      timestamptz not null default now()
);
create index if not exists pharmacy_formulary_pharmacy_idx
  on public.pharmacy_formulary (pharmacy_id, chemical_name);

create table if not exists public.drug_database (
  id            uuid primary key default gen_random_uuid(),
  organization  text not null references public.organizations(name)
                  on update cascade on delete cascade,
  drug_name     text not null check (char_length(drug_name) between 1 and 200),
  generic_name  text not null default '' check (char_length(generic_name) <= 200),
  din           text not null default '' check (char_length(din) <= 20),
  strength      text not null default '' check (char_length(strength) <= 80),
  dosage_form   text not null default '' check (char_length(dosage_form) <= 80),
  schedule      text not null default '' check (char_length(schedule) <= 40),
  notes         text not null default '' check (char_length(notes) <= 1000),
  updated_at    timestamptz not null default now()
);
create index if not exists drug_database_org_idx
  on public.drug_database (organization, drug_name);

create table if not exists public.intervention_codes (
  id            uuid primary key default gen_random_uuid(),
  organization  text not null references public.organizations(name)
                  on update cascade on delete cascade,
  code          text not null check (char_length(code) between 1 and 12),
  description   text not null check (char_length(description) between 1 and 300),
  category      text not null default '' check (char_length(category) <= 60),
  notes         text not null default '' check (char_length(notes) <= 1000),
  updated_at    timestamptz not null default now()
);
create index if not exists intervention_codes_org_idx
  on public.intervention_codes (organization, code);

-- ---------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER so policies don't recurse through profiles RLS)
-- ---------------------------------------------------------------------------
create or replace function public.can_view_pharmacy(p_pharmacy_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.portal_pharmacies ph
    join public.profiles p on p.id = auth.uid()
    where ph.id = p_pharmacy_id
      and p.status = 'active'
      and (
        p.role = 'super_admin'
        or (ph.organization = p.organization
            and (p.role = 'admin'
                 or exists (select 1 from public.pharmacy_access a
                            where a.pharmacy_id = ph.id and a.user_id = p.id)))
      )
  );
$$;

create or replace function public.can_manage_pharmacy(p_pharmacy_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.portal_pharmacies ph
    join public.profiles p on p.id = auth.uid()
    where ph.id = p_pharmacy_id
      and p.status = 'active'
      and (p.role = 'super_admin'
           or (p.role = 'admin' and ph.organization = p.organization))
  );
$$;

create or replace function public.can_manage_org(p_organization text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.status = 'active'
      and (p.role = 'super_admin'
           or (p.role = 'admin' and p.organization = p_organization))
  );
$$;

create or replace function public.can_read_org(p_organization text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.status = 'active'
      and (p.role = 'super_admin' or p.organization = p_organization)
  );
$$;

-- The user being granted access must belong to the pharmacy's organization.
create or replace function public.user_in_pharmacy_org(p_user_id uuid, p_pharmacy_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.profiles t
    join public.portal_pharmacies ph on ph.id = p_pharmacy_id
    where t.id = p_user_id and t.organization = ph.organization
  );
$$;

revoke all on function public.user_in_pharmacy_org(uuid, uuid) from public, anon;
grant execute on function public.user_in_pharmacy_org(uuid, uuid) to authenticated;
revoke all on function public.can_view_pharmacy(uuid)  from public, anon;
revoke all on function public.can_manage_pharmacy(uuid) from public, anon;
revoke all on function public.can_manage_org(text)     from public, anon;
revoke all on function public.can_read_org(text)       from public, anon;
grant execute on function public.can_view_pharmacy(uuid)  to authenticated;
grant execute on function public.can_manage_pharmacy(uuid) to authenticated;
grant execute on function public.can_manage_org(text)     to authenticated;
grant execute on function public.can_read_org(text)       to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.portal_pharmacies  enable row level security;
alter table public.pharmacy_access    enable row level security;
alter table public.pharmacy_notices   enable row level security;
alter table public.pharmacy_policies  enable row level security;
alter table public.pharmacy_formulary enable row level security;
alter table public.drug_database      enable row level security;
alter table public.intervention_codes enable row level security;

do $$
declare t text;
begin
  -- portal_pharmacies
  drop policy if exists portal_pharmacies_read   on public.portal_pharmacies;
  drop policy if exists portal_pharmacies_insert on public.portal_pharmacies;
  drop policy if exists portal_pharmacies_update on public.portal_pharmacies;
  drop policy if exists portal_pharmacies_delete on public.portal_pharmacies;
  create policy portal_pharmacies_read on public.portal_pharmacies
    for select to authenticated using (public.can_view_pharmacy(id));
  create policy portal_pharmacies_insert on public.portal_pharmacies
    for insert to authenticated with check (public.can_manage_org(organization));
  create policy portal_pharmacies_update on public.portal_pharmacies
    for update to authenticated using (public.can_manage_pharmacy(id))
    with check (public.can_manage_org(organization));
  create policy portal_pharmacies_delete on public.portal_pharmacies
    for delete to authenticated using (public.can_manage_pharmacy(id));

  -- pharmacy_access
  drop policy if exists pharmacy_access_read   on public.pharmacy_access;
  drop policy if exists pharmacy_access_insert on public.pharmacy_access;
  drop policy if exists pharmacy_access_delete on public.pharmacy_access;
  create policy pharmacy_access_read on public.pharmacy_access
    for select to authenticated
    using (user_id = auth.uid() or public.can_manage_pharmacy(pharmacy_id));
  create policy pharmacy_access_insert on public.pharmacy_access
    for insert to authenticated
    with check (public.can_manage_pharmacy(pharmacy_id)
                and public.user_in_pharmacy_org(user_id, pharmacy_id));
  create policy pharmacy_access_delete on public.pharmacy_access
    for delete to authenticated using (public.can_manage_pharmacy(pharmacy_id));

  -- Per-pharmacy content: read with access, write as admin.
  foreach t in array array['pharmacy_notices', 'pharmacy_policies', 'pharmacy_formulary'] loop
    execute format('drop policy if exists %1$s_read   on public.%1$s', t);
    execute format('drop policy if exists %1$s_insert on public.%1$s', t);
    execute format('drop policy if exists %1$s_update on public.%1$s', t);
    execute format('drop policy if exists %1$s_delete on public.%1$s', t);
    execute format('create policy %1$s_read on public.%1$s for select to authenticated
                      using (public.can_view_pharmacy(pharmacy_id))', t);
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated
                      with check (public.can_manage_pharmacy(pharmacy_id))', t);
    execute format('create policy %1$s_update on public.%1$s for update to authenticated
                      using (public.can_manage_pharmacy(pharmacy_id))
                      with check (public.can_manage_pharmacy(pharmacy_id))', t);
    execute format('create policy %1$s_delete on public.%1$s for delete to authenticated
                      using (public.can_manage_pharmacy(pharmacy_id))', t);
  end loop;

  -- Organization-wide reference data: everyone in the org reads, admins write.
  foreach t in array array['drug_database', 'intervention_codes'] loop
    execute format('drop policy if exists %1$s_read   on public.%1$s', t);
    execute format('drop policy if exists %1$s_insert on public.%1$s', t);
    execute format('drop policy if exists %1$s_update on public.%1$s', t);
    execute format('drop policy if exists %1$s_delete on public.%1$s', t);
    execute format('create policy %1$s_read on public.%1$s for select to authenticated
                      using (public.can_read_org(organization))', t);
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated
                      with check (public.can_manage_org(organization))', t);
    execute format('create policy %1$s_update on public.%1$s for update to authenticated
                      using (public.can_manage_org(organization))
                      with check (public.can_manage_org(organization))', t);
    execute format('create policy %1$s_delete on public.%1$s for delete to authenticated
                      using (public.can_manage_org(organization))', t);
  end loop;
end $$;

grant select, insert, update, delete on
  public.portal_pharmacies, public.pharmacy_access, public.pharmacy_notices,
  public.pharmacy_policies, public.pharmacy_formulary, public.drug_database,
  public.intervention_codes
to authenticated;
revoke all on
  public.portal_pharmacies, public.pharmacy_access, public.pharmacy_notices,
  public.pharmacy_policies, public.pharmacy_formulary, public.drug_database,
  public.intervention_codes
from anon;

-- ---------------------------------------------------------------------------
-- Seed: the five pharmacies for Henderson's Pharmacy (skipped if the
-- organization doesn't exist; never duplicates).
-- ---------------------------------------------------------------------------
insert into public.portal_pharmacies (organization, slug, name, sort_order, pharma_tenant_id)
select 'Henderson''s Pharmacy', s.slug, s.name, s.sort_order, s.tenant
from (values
  ('lanark',        'Lanark Pharmacy',        1, null::uuid),
  ('eustace',       'Eustace Pharmacy',       2, null::uuid),
  ('hendersons',    'Henderson''s Pharmacy',  3, 'f397b606-bbec-465c-b0fa-2e133054e466'::uuid),
  ('moose-factory', 'Moose Factory Pharmacy', 4, null::uuid),
  ('downey',        'Downey Pharmacy',        5, null::uuid)
) as s(slug, name, sort_order, tenant)
where exists (select 1 from public.organizations o where o.name = 'Henderson''s Pharmacy')
on conflict (organization, slug) do nothing;
