create extension if not exists pgcrypto;

alter table public.estimate_cost_code_items
  alter column project_id drop not null;

alter table public.estimate_labor_rates
  alter column project_id drop not null;

alter table public.estimate_labor_entries
  alter column project_id drop not null;

alter table public.estimate_material_entries
  alter column project_id drop not null;

alter table public.estimate_equipment_entries
  alter column project_id drop not null;

alter table public.estimate_direct_overhead_entries
  alter column project_id drop not null;

create table if not exists public.company_user_module_access (
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null,
  module_key text not null check (module_key in ('leads', 'clients', 'projects', 'invoices', 'estimates')),
  granted boolean not null default true,
  updated_by_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, user_id, module_key)
);

create index if not exists company_user_module_access_user_idx
  on public.company_user_module_access (user_id, module_key);

insert into public.company_user_module_access (company_id, user_id, module_key, granted)
select
  cu.company_id,
  cu.user_id,
  module_key,
  true
from public.company_users cu
cross join unnest(array['leads', 'clients', 'projects', 'invoices', 'estimates']) as module_key
where cu.role <> 'owner'
on conflict (company_id, user_id, module_key) do nothing;

create table if not exists public.time_clock_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null,
  project_id uuid references public.projects (id) on delete set null,
  entry_date date not null default current_date,
  clock_in timestamptz not null,
  clock_out timestamptz,
  break_minutes int not null default 0,
  work_type text not null default 'overhead' check (work_type in ('project', 'overhead')),
  overhead_label text,
  notes text,
  payable_minutes int not null default 0,
  regular_minutes int not null default 0,
  overtime_minutes int not null default 0,
  is_manual boolean not null default false,
  edited_by_user_id uuid,
  edited_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists time_clock_entries_company_user_idx
  on public.time_clock_entries (company_id, user_id, entry_date desc, clock_in desc);

create index if not exists time_clock_entries_company_project_idx
  on public.time_clock_entries (company_id, project_id, entry_date desc);

create index if not exists time_clock_entries_active_idx
  on public.time_clock_entries (company_id, clock_out)
  where clock_out is null;

create or replace function public.acm_sync_time_clock_entry()
returns trigger
language plpgsql
as $$
declare
  v_minutes int;
begin
  new.entry_date := timezone('utc', coalesce(new.clock_in, now()))::date;
  new.break_minutes := greatest(coalesce(new.break_minutes, 0), 0);
  new.updated_at := now();

  if new.work_type = 'project' then
    new.overhead_label := null;
  elsif coalesce(trim(new.overhead_label), '') = '' then
    new.overhead_label := 'Overhead';
  end if;

  if new.clock_out is null or new.clock_out <= new.clock_in then
    new.payable_minutes := 0;
  else
    v_minutes := greatest(floor(extract(epoch from (new.clock_out - new.clock_in)) / 60)::int - new.break_minutes, 0);
    new.payable_minutes := v_minutes;
  end if;

  new.regular_minutes := greatest(coalesce(new.regular_minutes, 0), 0);
  new.overtime_minutes := greatest(coalesce(new.overtime_minutes, 0), 0);
  return new;
end;
$$;

drop trigger if exists acm_sync_time_clock_entry on public.time_clock_entries;
create trigger acm_sync_time_clock_entry
before insert or update on public.time_clock_entries
for each row execute function public.acm_sync_time_clock_entry();

alter table public.company_user_module_access enable row level security;
alter table public.time_clock_entries enable row level security;

drop policy if exists "company_user_module_access_select_company_users" on public.company_user_module_access;
create policy "company_user_module_access_select_company_users"
on public.company_user_module_access
for select
to authenticated
using (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = company_user_module_access.company_id
      and cu.user_id = auth.uid()
  )
);

drop policy if exists "company_user_module_access_write_owner_or_manager" on public.company_user_module_access;
create policy "company_user_module_access_write_owner_or_manager"
on public.company_user_module_access
for all
to authenticated
using (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = company_user_module_access.company_id
      and cu.user_id = auth.uid()
      and cu.role = 'owner'
  )
  or exists (
    select 1
    from public.project_users pu
    join public.company_users cu
      on cu.company_id = company_user_module_access.company_id
     and cu.user_id = pu.user_id
    where cu.company_id = company_user_module_access.company_id
      and cu.user_id = auth.uid()
      and cu.role = 'manager'
  )
)
with check (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = company_user_module_access.company_id
      and cu.user_id = auth.uid()
      and cu.role = 'owner'
  )
);

drop policy if exists "time_clock_entries_select_company_scope" on public.time_clock_entries;
create policy "time_clock_entries_select_company_scope"
on public.time_clock_entries
for select
to authenticated
using (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = time_clock_entries.company_id
      and cu.user_id = auth.uid()
      and (
        cu.role = 'owner'
        or cu.user_id = time_clock_entries.user_id
        or exists (
          select 1
          from public.project_users my_pu
          join public.project_users target_pu
            on target_pu.project_id = my_pu.project_id
          where my_pu.user_id = auth.uid()
            and my_pu.role = 'manager'
            and target_pu.user_id = time_clock_entries.user_id
        )
      )
  )
);

drop policy if exists "time_clock_entries_write_company_scope" on public.time_clock_entries;
create policy "time_clock_entries_write_company_scope"
on public.time_clock_entries
for all
to authenticated
using (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = time_clock_entries.company_id
      and cu.user_id = auth.uid()
      and (
        cu.role = 'owner'
        or cu.user_id = time_clock_entries.user_id
        or exists (
          select 1
          from public.project_users my_pu
          join public.project_users target_pu
            on target_pu.project_id = my_pu.project_id
          where my_pu.user_id = auth.uid()
            and my_pu.role = 'manager'
            and target_pu.user_id = time_clock_entries.user_id
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = time_clock_entries.company_id
      and cu.user_id = auth.uid()
      and (
        cu.role = 'owner'
        or cu.user_id = time_clock_entries.user_id
        or exists (
          select 1
          from public.project_users my_pu
          join public.project_users target_pu
            on target_pu.project_id = my_pu.project_id
          where my_pu.user_id = auth.uid()
            and my_pu.role = 'manager'
            and target_pu.user_id = time_clock_entries.user_id
        )
      )
  )
);
