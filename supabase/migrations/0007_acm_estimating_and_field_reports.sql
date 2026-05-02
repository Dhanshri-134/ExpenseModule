create extension if not exists pgcrypto;

create table if not exists public.project_estimates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  estimate_number int not null,
  title text not null,
  estimate_date date not null default current_date,
  status text not null default 'draft',
  overhead_percent numeric(10,4) not null default 0,
  profit_percent numeric(10,4) not null default 0,
  commission_percent numeric(10,4) not null default 0,
  notes text,
  line_items jsonb not null default '[]'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  prepared_by_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, estimate_number)
);

create index if not exists project_estimates_company_id_idx on public.project_estimates (company_id);
create index if not exists project_estimates_project_id_idx on public.project_estimates (project_id);
create index if not exists project_estimates_prepared_by_idx on public.project_estimates (prepared_by_user_id);

alter table public.project_estimates enable row level security;

create table if not exists public.field_reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  report_date date not null,
  report_time text,
  location text,
  weather_conditions text,
  temperature_range text,
  weather_impact text,
  work_activities jsonb not null default '[]'::jsonb,
  coordination_logs jsonb not null default '[]'::jsonb,
  comments text,
  site_pictures jsonb not null default '[]'::jsonb,
  signoff_name text,
  signoff_role text,
  created_by_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists field_reports_company_id_idx on public.field_reports (company_id);
create index if not exists field_reports_project_id_idx on public.field_reports (project_id);
create index if not exists field_reports_created_by_idx on public.field_reports (created_by_user_id);
create index if not exists field_reports_report_date_idx on public.field_reports (report_date desc);

alter table public.field_reports enable row level security;

drop policy if exists "project_estimates_select_owner_or_project_member" on public.project_estimates;
create policy "project_estimates_select_owner_or_project_member"
on public.project_estimates
for select
to authenticated
using (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = project_estimates.company_id
      and cu.user_id = auth.uid()
      and cu.role = 'owner'
  )
  or exists (
    select 1
    from public.project_users pu
    where pu.project_id = project_estimates.project_id
      and pu.user_id = auth.uid()
  )
);

drop policy if exists "project_estimates_write_owner_or_manager" on public.project_estimates;
create policy "project_estimates_write_owner_or_manager"
on public.project_estimates
for all
to authenticated
using (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = project_estimates.company_id
      and cu.user_id = auth.uid()
      and cu.role = 'owner'
  )
  or exists (
    select 1
    from public.project_users pu
    where pu.project_id = project_estimates.project_id
      and pu.user_id = auth.uid()
      and pu.role = 'manager'
  )
)
with check (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = project_estimates.company_id
      and cu.user_id = auth.uid()
      and cu.role = 'owner'
  )
  or exists (
    select 1
    from public.project_users pu
    where pu.project_id = project_estimates.project_id
      and pu.user_id = auth.uid()
      and pu.role = 'manager'
  )
);

drop policy if exists "field_reports_select_owner_or_project_member" on public.field_reports;
create policy "field_reports_select_owner_or_project_member"
on public.field_reports
for select
to authenticated
using (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = field_reports.company_id
      and cu.user_id = auth.uid()
      and cu.role = 'owner'
  )
  or exists (
    select 1
    from public.project_users pu
    where pu.project_id = field_reports.project_id
      and pu.user_id = auth.uid()
  )
);

drop policy if exists "field_reports_write_project_member" on public.field_reports;
create policy "field_reports_write_project_member"
on public.field_reports
for all
to authenticated
using (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = field_reports.company_id
      and cu.user_id = auth.uid()
      and cu.role = 'owner'
  )
  or exists (
    select 1
    from public.project_users pu
    where pu.project_id = field_reports.project_id
      and pu.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = field_reports.company_id
      and cu.user_id = auth.uid()
      and cu.role = 'owner'
  )
  or exists (
    select 1
    from public.project_users pu
    where pu.project_id = field_reports.project_id
      and pu.user_id = auth.uid()
  )
);
