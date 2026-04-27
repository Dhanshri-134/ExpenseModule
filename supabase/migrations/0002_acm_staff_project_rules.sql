-- ACM Desk - Phase 1 (Staff structure + ID formats + strict access rules)
-- Run after: 0001_acm_phase1_schema.sql

create extension if not exists pgcrypto;
create extension if not exists citext;

-- Staff role counters for User ID generation per company
create table if not exists public.company_role_counters (
  company_id uuid not null references public.companies (id) on delete cascade,
  role public.acm_role not null,
  last_number int not null default 0,
  primary key (company_id, role)
);

-- Project job number counters per company/year
create table if not exists public.project_job_counters (
  company_id uuid not null references public.companies (id) on delete cascade,
  year int not null,
  last_number int not null default 0,
  primary key (company_id, year)
);

-- Add staff fields + generated user_code to company_users
alter table public.company_users
  add column if not exists user_code text,
  add column if not exists role_number int,
  add column if not exists mobile_no text,
  add column if not exists hourly_rate numeric(10,2) not null default 0,
  add column if not exists created_by_user_id uuid references auth.users (id) on delete set null,
  add column if not exists created_in_project_id uuid references public.projects (id) on delete set null;

create unique index if not exists company_users_user_code_ux on public.company_users (user_code);

-- Add project job_number (auto) + prevent edits
alter table public.projects
  add column if not exists job_number text,
  add column if not exists job_year int,
  add column if not exists job_running_number int;

create unique index if not exists projects_job_number_ux on public.projects (job_number);

-- Next role number allocator (atomic per company+role)
create or replace function public.acm_next_role_number(p_company_id uuid, p_role public.acm_role)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next int;
begin
  insert into public.company_role_counters(company_id, role, last_number)
  values (p_company_id, p_role, 0)
  on conflict (company_id, role) do nothing;

  update public.company_role_counters
  set last_number = last_number + 1
  where company_id = p_company_id and role = p_role
  returning last_number into v_next;

  return v_next;
end $$;

-- Next job number allocator (atomic per company+year)
create or replace function public.acm_next_job_number(p_company_id uuid)
returns table (job_year int, running_number int, job_number text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year int := extract(year from now())::int;
  v_next int;
  v_code text;
begin
  select code into v_code from public.companies where id = p_company_id;
  if v_code is null then
    raise exception 'Invalid company_id';
  end if;

  insert into public.project_job_counters(company_id, year, last_number)
  values (p_company_id, v_year, 0)
  on conflict (company_id, year) do nothing;

  update public.project_job_counters
  set last_number = last_number + 1
  where company_id = p_company_id and year = v_year
  returning last_number into v_next;

  job_year := v_year;
  running_number := v_next;
  job_number := v_code || '-' || v_year::text || '-' || lpad(v_next::text, 3, '0');
  return next;
end $$;

-- Generate user_code + role_number on insert into company_users
create or replace function public.acm_company_users_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_code text;
  v_role_num int;
  v_creator_role public.acm_role;
  v_creator_role_num int;
begin
  if new.created_by_user_id is null then
    new.created_by_user_id := auth.uid();
  end if;

  select code into v_company_code from public.companies where id = new.company_id;
  if v_company_code is null then
    raise exception 'Invalid company_id';
  end if;

  if new.role_number is null then
    v_role_num := public.acm_next_role_number(new.company_id, new.role);
    new.role_number := v_role_num;
  else
    v_role_num := new.role_number;
  end if;

  -- For manager-created employees, optionally embed the manager number:
  -- ACM-M1-E-001
  if new.role = 'employee' and new.created_by_user_id is not null then
    select cu.role, cu.role_number
      into v_creator_role, v_creator_role_num
    from public.company_users cu
    where cu.company_id = new.company_id
      and cu.user_id = new.created_by_user_id
    limit 1;

    if v_creator_role = 'manager' and v_creator_role_num is not null then
      if new.created_in_project_id is null then
        raise exception 'Manager-created employees must include created_in_project_id';
      end if;
      new.user_code := v_company_code || '-M' || v_creator_role_num::text || '-E-' || lpad(v_role_num::text, 3, '0');
      return new;
    end if;
  end if;

  if new.user_code is null then
    if new.role = 'owner' then
      new.user_code := v_company_code || '-O-001';
    elsif new.role = 'manager' then
      new.user_code := v_company_code || '-M-' || lpad(v_role_num::text, 3, '0');
    else
      new.user_code := v_company_code || '-E-' || lpad(v_role_num::text, 3, '0');
    end if;
  end if;

  return new;
end $$;

drop trigger if exists trg_company_users_before_insert on public.company_users;
create trigger trg_company_users_before_insert
before insert on public.company_users
for each row
execute function public.acm_company_users_before_insert();

-- Generate job_number on insert into projects + block edits
create or replace function public.acm_projects_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v int;
  r int;
  j text;
begin
  if new.job_number is null then
    select job_year, running_number, job_number
      into v, r, j
    from public.acm_next_job_number(new.company_id)
    limit 1;

    new.job_year := v;
    new.job_running_number := r;
    new.job_number := j;
  end if;
  return new;
end $$;

create or replace function public.acm_projects_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.job_number is distinct from old.job_number then
    raise exception 'job_number cannot be edited after creation';
  end if;
  return new;
end $$;

drop trigger if exists trg_projects_before_insert on public.projects;
create trigger trg_projects_before_insert
before insert on public.projects
for each row
execute function public.acm_projects_before_insert();

drop trigger if exists trg_projects_before_update on public.projects;
create trigger trg_projects_before_update
before update on public.projects
for each row
execute function public.acm_projects_before_update();

-- Helper views for common pages
create or replace view public.projects_display as
select
  p.id,
  p.company_id,
  p.job_number,
  p.name,
  p.location,
  p.client_id,
  p.start_date,
  p.end_date,
  p.contract_value,
  p.created_at
from public.projects p;

-- Strict access rules (RLS)
-- Replace earlier permissive policies for projects/clients/project_users/company_users.

-- projects: owner sees all in company; manager/employee see only assigned projects
drop policy if exists "projects_select_member_company" on public.projects;
drop policy if exists "projects_select_owner_or_assigned" on public.projects;
create policy "projects_select_owner_or_assigned"
on public.projects
for select
to authenticated
using (
  exists (
    select 1 from public.company_users cu
    where cu.company_id = projects.company_id
      and cu.user_id = auth.uid()
      and cu.role = 'owner'
  )
  or exists (
    select 1 from public.project_users pu
    where pu.project_id = projects.id
      and pu.user_id = auth.uid()
  )
);

-- clients: owner sees all in company; manager/employee see clients for their assigned projects
drop policy if exists "clients_select_member_company" on public.clients;
drop policy if exists "clients_select_owner_or_project_member" on public.clients;
create policy "clients_select_owner_or_project_member"
on public.clients
for select
to authenticated
using (
  exists (
    select 1 from public.company_users cu
    where cu.company_id = clients.company_id
      and cu.user_id = auth.uid()
      and cu.role = 'owner'
  )
  or exists (
    select 1
    from public.projects p
    join public.project_users pu on pu.project_id = p.id
    where p.client_id = clients.id
      and pu.user_id = auth.uid()
  )
);

-- company_users: owner sees all staff; manager sees self + employees within their projects; employee sees self
drop policy if exists "company_users_select_own" on public.company_users;
drop policy if exists "company_users_select_owner_or_scoped" on public.company_users;
create policy "company_users_select_owner_or_scoped"
on public.company_users
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.company_users me
    where me.company_id = company_users.company_id
      and me.user_id = auth.uid()
      and me.role = 'owner'
  )
  or (
    company_users.role = 'employee'
    and exists (
      select 1
      from public.project_users my_pu
      join public.project_users emp_pu on emp_pu.project_id = my_pu.project_id
      where my_pu.user_id = auth.uid()
        and my_pu.role = 'manager'
        and emp_pu.user_id = company_users.user_id
        and emp_pu.role = 'employee'
    )
  )
);

-- project_users: owner can read all within company; members can read rows for their projects
drop policy if exists "project_users_select_own" on public.project_users;
drop policy if exists "project_users_select_owner_or_project_member" on public.project_users;
create policy "project_users_select_owner_or_project_member"
on public.project_users
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.projects p
    join public.company_users cu on cu.company_id = p.company_id
    where p.id = project_users.project_id
      and cu.user_id = auth.uid()
      and cu.role = 'owner'
  )
  or exists (
    select 1 from public.project_users my
    where my.project_id = project_users.project_id
      and my.user_id = auth.uid()
  )
);

-- Insert rules (enforced at DB level for non-service role clients)
-- Owners can create managers/employees at company level.
drop policy if exists "company_users_insert_owner" on public.company_users;
create policy "company_users_insert_owner"
on public.company_users
for insert
to authenticated
with check (
  exists (
    select 1 from public.company_users cu
    where cu.company_id = company_users.company_id
      and cu.user_id = auth.uid()
      and cu.role = 'owner'
  )
);

-- Managers can create employees only, and only for their managed project (created_in_project_id).
drop policy if exists "company_users_insert_manager_employee_in_project" on public.company_users;
create policy "company_users_insert_manager_employee_in_project"
on public.company_users
for insert
to authenticated
with check (
  company_users.role = 'employee'
  and company_users.created_in_project_id is not null
  and exists (
    select 1
    from public.company_users me
    where me.company_id = company_users.company_id
      and me.user_id = auth.uid()
      and me.role = 'manager'
  )
  and exists (
    select 1
    from public.project_users my
    join public.projects p on p.id = my.project_id
    where my.user_id = auth.uid()
      and my.role = 'manager'
      and my.project_id = company_users.created_in_project_id
      and p.company_id = company_users.company_id
  )
);

-- Owners can assign managers/employees to projects; managers can assign/create employees only in their project
drop policy if exists "project_users_insert_owner_or_manager" on public.project_users;
create policy "project_users_insert_owner_or_manager"
on public.project_users
for insert
to authenticated
with check (
  exists (
    select 1
    from public.projects p
    join public.company_users cu on cu.company_id = p.company_id
    where p.id = project_users.project_id
      and cu.user_id = auth.uid()
      and cu.role = 'owner'
  )
  or (
    project_users.role = 'employee'
    and exists (
      select 1
      from public.project_users my
      where my.project_id = project_users.project_id
        and my.user_id = auth.uid()
        and my.role = 'manager'
    )
  )
);

-- Optional helper for login-by-user_code (security definer).
-- WARNING: This enables user-code -> email lookup and can be abused for enumeration.
-- Prefer moving this logic to a rate-limited Edge Function in production.
create or replace function public.acm_resolve_email(login_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_email text;
begin
  if login_id is null or length(trim(login_id)) = 0 then
    return null;
  end if;

  if position('@' in login_id) > 0 then
    return login_id;
  end if;

  select cu.user_id into v_user_id
  from public.company_users cu
  where cu.user_code = login_id
  limit 1;

  if v_user_id is null then
    return null;
  end if;

  select u.email into v_email from auth.users u where u.id = v_user_id;
  return v_email;
end $$;
