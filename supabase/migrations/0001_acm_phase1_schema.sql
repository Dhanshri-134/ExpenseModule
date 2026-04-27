-- ACM Desk - Phase 1 normalized schema (Supabase/Postgres)
-- Notes:
-- - Uses Supabase Auth (`auth.users`) for identities.
-- - Keeps "Owner / Manager / Employee" as roles on membership tables (normalized).
-- - Provides optional views that resemble the requested "Owner/Manager/Employee" shapes.

create extension if not exists pgcrypto;
create extension if not exists citext;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'acm_role') then
    create type public.acm_role as enum ('owner', 'manager', 'employee');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'acm_project_role') then
    create type public.acm_project_role as enum ('manager', 'employee');
  end if;
end $$;

-- Companies (tenant root)
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  owner_user_id uuid not null references auth.users (id) on delete restrict,
  address text,
  contact text,
  email citext,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- People (normalized person details; can be linked to auth users and/or company membership)
create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text,
  email citext,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Company membership for Supabase-auth users (role = owner/manager/employee)
create table if not exists public.company_users (
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.acm_role not null,
  person_id uuid references public.people (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, user_id)
);

-- One owner per company (enforced by partial unique index)
create unique index if not exists companies_one_owner_idx
  on public.company_users (company_id)
  where role = 'owner';

-- Clients belong to a company
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  address text,
  contact text,
  email citext,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clients_company_id_idx on public.clients (company_id);

-- Projects belong to a company and optionally a client
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  name text not null,
  location text,
  start_date date,
  end_date date,
  contract_value numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_company_id_idx on public.projects (company_id);
create index if not exists projects_client_id_idx on public.projects (client_id);

-- Project assignment for managers/employees with hourly rate (normalized)
create table if not exists public.project_users (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.acm_project_role not null,
  hourly_rate numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index if not exists project_users_project_id_idx on public.project_users (project_id);
create index if not exists project_users_user_id_idx on public.project_users (user_id);

-- Optional views to resemble the originally requested shapes (read-only convenience)
create or replace view public.owners as
select
  cu.user_id as owner_id,
  c.id as company_id,
  coalesce(p.name, '') as name,
  coalesce(p.contact, '') as contact,
  coalesce(p.address, '') as address,
  coalesce(p.email, null) as email
from public.company_users cu
join public.companies c on c.id = cu.company_id
left join public.people p on p.id = cu.person_id
where cu.role = 'owner';

create or replace view public.managers as
select
  pu.user_id as id,
  coalesce(p.name, '') as name,
  coalesce(p.contact, '') as contact,
  coalesce(p.email, null) as email,
  coalesce(p.address, '') as address,
  pu.project_id as project_id,
  pu.hourly_rate as hourly_rate
from public.project_users pu
left join public.people p on p.id = (
  select cu.person_id
  from public.company_users cu
  where cu.user_id = pu.user_id
  limit 1
)
where pu.role = 'manager';

create or replace view public.employees as
select
  pu.user_id as id,
  coalesce(p.name, '') as name,
  coalesce(p.contact, '') as contact,
  coalesce(p.email, null) as email,
  coalesce(p.address, '') as address,
  pu.project_id as project_id,
  pu.hourly_rate as hourly_rate
from public.project_users pu
left join public.people p on p.id = (
  select cu.person_id
  from public.company_users cu
  where cu.user_id = pu.user_id
  limit 1
)
where pu.role = 'employee';

-- RLS (minimal policies to support role checks and user self-reads)
alter table public.companies enable row level security;
alter table public.people enable row level security;
alter table public.company_users enable row level security;
alter table public.clients enable row level security;
alter table public.projects enable row level security;
alter table public.project_users enable row level security;

-- Company users can read their own membership rows
drop policy if exists "company_users_select_own" on public.company_users;
create policy "company_users_select_own"
on public.company_users
for select
to authenticated
using (user_id = auth.uid());

-- Project users can read their own assignment rows
drop policy if exists "project_users_select_own" on public.project_users;
create policy "project_users_select_own"
on public.project_users
for select
to authenticated
using (user_id = auth.uid());

-- Company users can read their company row
drop policy if exists "companies_select_member" on public.companies;
create policy "companies_select_member"
on public.companies
for select
to authenticated
using (
  exists (
    select 1 from public.company_users cu
    where cu.company_id = companies.id
      and cu.user_id = auth.uid()
  )
);

-- Company users can read clients/projects for their company
drop policy if exists "clients_select_member_company" on public.clients;
create policy "clients_select_member_company"
on public.clients
for select
to authenticated
using (
  exists (
    select 1 from public.company_users cu
    where cu.company_id = clients.company_id
      and cu.user_id = auth.uid()
  )
);

drop policy if exists "projects_select_member_company" on public.projects;
create policy "projects_select_member_company"
on public.projects
for select
to authenticated
using (
  exists (
    select 1 from public.company_users cu
    where cu.company_id = projects.company_id
      and cu.user_id = auth.uid()
  )
);

-- People: allow a user to read the person row attached to their membership (if any)
drop policy if exists "people_select_self_via_membership" on public.people;
create policy "people_select_self_via_membership"
on public.people
for select
to authenticated
using (
  exists (
    select 1 from public.company_users cu
    where cu.person_id = people.id
      and cu.user_id = auth.uid()
  )
);
