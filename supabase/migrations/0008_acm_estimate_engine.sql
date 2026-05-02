create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'acm_estimate_scenario') then
    create type public.acm_estimate_scenario as enum ('best_case', 'expected_case', 'worst_case');
  end if;
end $$;

alter table public.project_estimates
  add column if not exists scenario public.acm_estimate_scenario not null default 'expected_case',
  add column if not exists risk_percent numeric(10,4) not null default 0,
  add column if not exists inflation_rate numeric(10,4) not null default 0,
  add column if not exists escalation_years numeric(10,2) not null default 0;

create index if not exists project_estimates_scenario_idx
  on public.project_estimates (project_id, scenario, estimate_number desc);

create table if not exists public.cost_codes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  unit text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, code)
);

create index if not exists cost_codes_company_id_idx on public.cost_codes (company_id);

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  description text,
  unit text,
  default_unit_rate numeric(14,4) not null default 0,
  default_waste_percent numeric(10,4) not null default 0,
  default_tax_percent numeric(10,4) not null default 0,
  default_freight numeric(14,4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists materials_company_id_idx on public.materials (company_id);

create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  description text,
  unit text,
  default_rate numeric(14,4) not null default 0,
  default_freight numeric(14,4) not null default 0,
  default_fuel numeric(14,4) not null default 0,
  default_tax_percent numeric(10,4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists equipment_company_id_idx on public.equipment (company_id);

create table if not exists public.estimate_cost_code_items (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.project_estimates (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  cost_code_id uuid not null references public.cost_codes (id) on delete restrict,
  description text,
  display_order int not null default 0,
  labor_cost numeric(14,4) not null default 0,
  material_cost numeric(14,4) not null default 0,
  equipment_cost numeric(14,4) not null default 0,
  direct_overhead numeric(14,4) not null default 0,
  total_cost numeric(14,4) not null default 0,
  overhead_percent numeric(10,4) not null default 0,
  overhead numeric(14,4) not null default 0,
  profit_percent numeric(10,4) not null default 0,
  profit numeric(14,4) not null default 0,
  commission_percent numeric(10,4) not null default 0,
  commission numeric(14,4) not null default 0,
  risk_percent numeric(10,4) not null default 0,
  contingency numeric(14,4) not null default 0,
  inflation_rate numeric(10,4) not null default 0,
  escalation_years numeric(10,2) not null default 0,
  future_cost numeric(14,4) not null default 0,
  total_price numeric(14,4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (estimate_id, cost_code_id)
);

create index if not exists estimate_cost_code_items_estimate_id_idx on public.estimate_cost_code_items (estimate_id);
create index if not exists estimate_cost_code_items_project_id_idx on public.estimate_cost_code_items (project_id);
create index if not exists estimate_cost_code_items_cost_code_id_idx on public.estimate_cost_code_items (cost_code_id);

create table if not exists public.estimate_labor_rates (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.project_estimates (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  project_user_id uuid references public.project_users (id) on delete set null,
  label text,
  base_wage numeric(14,4) not null default 0,
  fica numeric(14,4) not null default 0,
  sui numeric(14,4) not null default 0,
  fui numeric(14,4) not null default 0,
  workers_comp numeric(14,4) not null default 0,
  liability numeric(14,4) not null default 0,
  benefits numeric(14,4) not null default 0,
  tools numeric(14,4) not null default 0,
  ppe numeric(14,4) not null default 0,
  overhead_percent numeric(10,4) not null default 0,
  loaded_cost numeric(14,4) not null default 0,
  overhead numeric(14,4) not null default 0,
  st_rate numeric(14,4) not null default 0,
  ot_rate numeric(14,4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists estimate_labor_rates_estimate_id_idx on public.estimate_labor_rates (estimate_id);
create index if not exists estimate_labor_rates_project_user_id_idx on public.estimate_labor_rates (project_user_id);

create table if not exists public.estimate_labor_entries (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.project_estimates (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  cost_code_id uuid not null references public.cost_codes (id) on delete restrict,
  cost_code_item_id uuid not null references public.estimate_cost_code_items (id) on delete cascade,
  project_user_id uuid references public.project_users (id) on delete set null,
  labor_rate_id uuid references public.estimate_labor_rates (id) on delete set null,
  description text,
  st_hours numeric(14,4) not null default 0,
  st_rate numeric(14,4) not null default 0,
  st_cost numeric(14,4) not null default 0,
  ot_hours numeric(14,4) not null default 0,
  ot_rate numeric(14,4) not null default 0,
  ot_cost numeric(14,4) not null default 0,
  total_cost numeric(14,4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists estimate_labor_entries_estimate_id_idx on public.estimate_labor_entries (estimate_id);
create index if not exists estimate_labor_entries_cost_code_id_idx on public.estimate_labor_entries (cost_code_id);

create table if not exists public.estimate_material_entries (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.project_estimates (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  cost_code_id uuid not null references public.cost_codes (id) on delete restrict,
  cost_code_item_id uuid not null references public.estimate_cost_code_items (id) on delete cascade,
  material_id uuid references public.materials (id) on delete set null,
  description text,
  quantity numeric(14,4) not null default 0,
  waste_percent numeric(10,4) not null default 0,
  adjusted_qty numeric(14,4) not null default 0,
  unit_rate numeric(14,4) not null default 0,
  base_cost numeric(14,4) not null default 0,
  freight numeric(14,4) not null default 0,
  tax_percent numeric(10,4) not null default 0,
  total_cost numeric(14,4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists estimate_material_entries_estimate_id_idx on public.estimate_material_entries (estimate_id);
create index if not exists estimate_material_entries_cost_code_id_idx on public.estimate_material_entries (cost_code_id);

create table if not exists public.estimate_equipment_entries (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.project_estimates (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  cost_code_id uuid not null references public.cost_codes (id) on delete restrict,
  cost_code_item_id uuid not null references public.estimate_cost_code_items (id) on delete cascade,
  equipment_id uuid references public.equipment (id) on delete set null,
  description text,
  qty numeric(14,4) not null default 0,
  days numeric(14,4) not null default 0,
  rate numeric(14,4) not null default 0,
  base numeric(14,4) not null default 0,
  freight numeric(14,4) not null default 0,
  fuel numeric(14,4) not null default 0,
  subtotal numeric(14,4) not null default 0,
  tax_percent numeric(10,4) not null default 0,
  total_cost numeric(14,4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists estimate_equipment_entries_estimate_id_idx on public.estimate_equipment_entries (estimate_id);
create index if not exists estimate_equipment_entries_cost_code_id_idx on public.estimate_equipment_entries (cost_code_id);

create table if not exists public.estimate_direct_overhead_entries (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.project_estimates (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  cost_code_id uuid not null references public.cost_codes (id) on delete restrict,
  cost_code_item_id uuid not null references public.estimate_cost_code_items (id) on delete cascade,
  description text,
  qty numeric(14,4) not null default 0,
  days numeric(14,4) not null default 0,
  rate numeric(14,4) not null default 0,
  base numeric(14,4) not null default 0,
  tax_percent numeric(10,4) not null default 0,
  total_cost numeric(14,4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists estimate_direct_overhead_entries_estimate_id_idx on public.estimate_direct_overhead_entries (estimate_id);
create index if not exists estimate_direct_overhead_entries_cost_code_id_idx on public.estimate_direct_overhead_entries (cost_code_id);

alter table public.cost_codes enable row level security;
alter table public.materials enable row level security;
alter table public.equipment enable row level security;
alter table public.estimate_cost_code_items enable row level security;
alter table public.estimate_labor_rates enable row level security;
alter table public.estimate_labor_entries enable row level security;
alter table public.estimate_material_entries enable row level security;
alter table public.estimate_equipment_entries enable row level security;
alter table public.estimate_direct_overhead_entries enable row level security;

drop policy if exists "cost_codes_select_owner_or_project_member" on public.cost_codes;
create policy "cost_codes_select_owner_or_project_member"
on public.cost_codes
for select
to authenticated
using (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = cost_codes.company_id
      and cu.user_id = auth.uid()
  )
);

drop policy if exists "cost_codes_write_owner_or_manager" on public.cost_codes;
create policy "cost_codes_write_owner_or_manager"
on public.cost_codes
for all
to authenticated
using (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = cost_codes.company_id
      and cu.user_id = auth.uid()
      and cu.role = 'owner'
  )
)
with check (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = cost_codes.company_id
      and cu.user_id = auth.uid()
      and cu.role = 'owner'
  )
);

drop policy if exists "materials_select_owner_or_project_member" on public.materials;
create policy "materials_select_owner_or_project_member"
on public.materials
for select
to authenticated
using (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = materials.company_id
      and cu.user_id = auth.uid()
  )
);

drop policy if exists "materials_write_owner_or_manager" on public.materials;
create policy "materials_write_owner_or_manager"
on public.materials
for all
to authenticated
using (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = materials.company_id
      and cu.user_id = auth.uid()
      and cu.role = 'owner'
  )
)
with check (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = materials.company_id
      and cu.user_id = auth.uid()
      and cu.role = 'owner'
  )
);

drop policy if exists "equipment_select_owner_or_project_member" on public.equipment;
create policy "equipment_select_owner_or_project_member"
on public.equipment
for select
to authenticated
using (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = equipment.company_id
      and cu.user_id = auth.uid()
  )
);

drop policy if exists "equipment_write_owner_or_manager" on public.equipment;
create policy "equipment_write_owner_or_manager"
on public.equipment
for all
to authenticated
using (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = equipment.company_id
      and cu.user_id = auth.uid()
      and cu.role = 'owner'
  )
)
with check (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = equipment.company_id
      and cu.user_id = auth.uid()
      and cu.role = 'owner'
  )
);

drop policy if exists "estimate_cost_code_items_select_owner_or_project_member" on public.estimate_cost_code_items;
create policy "estimate_cost_code_items_select_owner_or_project_member"
on public.estimate_cost_code_items
for select
to authenticated
using (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = estimate_cost_code_items.company_id
      and cu.user_id = auth.uid()
      and cu.role = 'owner'
  )
  or exists (
    select 1
    from public.project_users pu
    where pu.project_id = estimate_cost_code_items.project_id
      and pu.user_id = auth.uid()
  )
);

drop policy if exists "estimate_cost_code_items_write_owner_or_manager" on public.estimate_cost_code_items;
create policy "estimate_cost_code_items_write_owner_or_manager"
on public.estimate_cost_code_items
for all
to authenticated
using (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = estimate_cost_code_items.company_id
      and cu.user_id = auth.uid()
      and cu.role = 'owner'
  )
  or exists (
    select 1
    from public.project_users pu
    where pu.project_id = estimate_cost_code_items.project_id
      and pu.user_id = auth.uid()
      and pu.role = 'manager'
  )
)
with check (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = estimate_cost_code_items.company_id
      and cu.user_id = auth.uid()
      and cu.role = 'owner'
  )
  or exists (
    select 1
    from public.project_users pu
    where pu.project_id = estimate_cost_code_items.project_id
      and pu.user_id = auth.uid()
      and pu.role = 'manager'
  )
);

drop policy if exists "estimate_labor_rates_select_owner_or_project_member" on public.estimate_labor_rates;
create policy "estimate_labor_rates_select_owner_or_project_member"
on public.estimate_labor_rates
for select
to authenticated
using (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = estimate_labor_rates.company_id
      and cu.user_id = auth.uid()
      and cu.role = 'owner'
  )
  or exists (
    select 1
    from public.project_users pu
    where pu.project_id = estimate_labor_rates.project_id
      and pu.user_id = auth.uid()
  )
);

drop policy if exists "estimate_labor_rates_write_owner_or_manager" on public.estimate_labor_rates;
create policy "estimate_labor_rates_write_owner_or_manager"
on public.estimate_labor_rates
for all
to authenticated
using (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = estimate_labor_rates.company_id
      and cu.user_id = auth.uid()
      and cu.role = 'owner'
  )
  or exists (
    select 1
    from public.project_users pu
    where pu.project_id = estimate_labor_rates.project_id
      and pu.user_id = auth.uid()
      and pu.role = 'manager'
  )
)
with check (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = estimate_labor_rates.company_id
      and cu.user_id = auth.uid()
      and cu.role = 'owner'
  )
  or exists (
    select 1
    from public.project_users pu
    where pu.project_id = estimate_labor_rates.project_id
      and pu.user_id = auth.uid()
      and pu.role = 'manager'
  )
);

drop policy if exists "estimate_labor_entries_select_owner_or_project_member" on public.estimate_labor_entries;
create policy "estimate_labor_entries_select_owner_or_project_member"
on public.estimate_labor_entries
for select
to authenticated
using (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = estimate_labor_entries.company_id
      and cu.user_id = auth.uid()
      and cu.role = 'owner'
  )
  or exists (
    select 1
    from public.project_users pu
    where pu.project_id = estimate_labor_entries.project_id
      and pu.user_id = auth.uid()
  )
);

drop policy if exists "estimate_labor_entries_write_owner_or_manager" on public.estimate_labor_entries;
create policy "estimate_labor_entries_write_owner_or_manager"
on public.estimate_labor_entries
for all
to authenticated
using (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = estimate_labor_entries.company_id
      and cu.user_id = auth.uid()
      and cu.role = 'owner'
  )
  or exists (
    select 1
    from public.project_users pu
    where pu.project_id = estimate_labor_entries.project_id
      and pu.user_id = auth.uid()
      and pu.role = 'manager'
  )
)
with check (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = estimate_labor_entries.company_id
      and cu.user_id = auth.uid()
      and cu.role = 'owner'
  )
  or exists (
    select 1
    from public.project_users pu
    where pu.project_id = estimate_labor_entries.project_id
      and pu.user_id = auth.uid()
      and pu.role = 'manager'
  )
);

drop policy if exists "estimate_material_entries_select_owner_or_project_member" on public.estimate_material_entries;
create policy "estimate_material_entries_select_owner_or_project_member"
on public.estimate_material_entries
for select
to authenticated
using (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = estimate_material_entries.company_id
      and cu.user_id = auth.uid()
      and cu.role = 'owner'
  )
  or exists (
    select 1
    from public.project_users pu
    where pu.project_id = estimate_material_entries.project_id
      and pu.user_id = auth.uid()
  )
);

drop policy if exists "estimate_material_entries_write_owner_or_manager" on public.estimate_material_entries;
create policy "estimate_material_entries_write_owner_or_manager"
on public.estimate_material_entries
for all
to authenticated
using (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = estimate_material_entries.company_id
      and cu.user_id = auth.uid()
      and cu.role = 'owner'
  )
  or exists (
    select 1
    from public.project_users pu
    where pu.project_id = estimate_material_entries.project_id
      and pu.user_id = auth.uid()
      and pu.role = 'manager'
  )
)
with check (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = estimate_material_entries.company_id
      and cu.user_id = auth.uid()
      and cu.role = 'owner'
  )
  or exists (
    select 1
    from public.project_users pu
    where pu.project_id = estimate_material_entries.project_id
      and pu.user_id = auth.uid()
      and pu.role = 'manager'
  )
);

drop policy if exists "estimate_equipment_entries_select_owner_or_project_member" on public.estimate_equipment_entries;
create policy "estimate_equipment_entries_select_owner_or_project_member"
on public.estimate_equipment_entries
for select
to authenticated
using (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = estimate_equipment_entries.company_id
      and cu.user_id = auth.uid()
      and cu.role = 'owner'
  )
  or exists (
    select 1
    from public.project_users pu
    where pu.project_id = estimate_equipment_entries.project_id
      and pu.user_id = auth.uid()
  )
);

drop policy if exists "estimate_equipment_entries_write_owner_or_manager" on public.estimate_equipment_entries;
create policy "estimate_equipment_entries_write_owner_or_manager"
on public.estimate_equipment_entries
for all
to authenticated
using (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = estimate_equipment_entries.company_id
      and cu.user_id = auth.uid()
      and cu.role = 'owner'
  )
  or exists (
    select 1
    from public.project_users pu
    where pu.project_id = estimate_equipment_entries.project_id
      and pu.user_id = auth.uid()
      and pu.role = 'manager'
  )
)
with check (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = estimate_equipment_entries.company_id
      and cu.user_id = auth.uid()
      and cu.role = 'owner'
  )
  or exists (
    select 1
    from public.project_users pu
    where pu.project_id = estimate_equipment_entries.project_id
      and pu.user_id = auth.uid()
      and pu.role = 'manager'
  )
);

drop policy if exists "estimate_direct_overhead_entries_select_owner_or_project_member" on public.estimate_direct_overhead_entries;
create policy "estimate_direct_overhead_entries_select_owner_or_project_member"
on public.estimate_direct_overhead_entries
for select
to authenticated
using (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = estimate_direct_overhead_entries.company_id
      and cu.user_id = auth.uid()
      and cu.role = 'owner'
  )
  or exists (
    select 1
    from public.project_users pu
    where pu.project_id = estimate_direct_overhead_entries.project_id
      and pu.user_id = auth.uid()
  )
);

drop policy if exists "estimate_direct_overhead_entries_write_owner_or_manager" on public.estimate_direct_overhead_entries;
create policy "estimate_direct_overhead_entries_write_owner_or_manager"
on public.estimate_direct_overhead_entries
for all
to authenticated
using (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = estimate_direct_overhead_entries.company_id
      and cu.user_id = auth.uid()
      and cu.role = 'owner'
  )
  or exists (
    select 1
    from public.project_users pu
    where pu.project_id = estimate_direct_overhead_entries.project_id
      and pu.user_id = auth.uid()
      and pu.role = 'manager'
  )
)
with check (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = estimate_direct_overhead_entries.company_id
      and cu.user_id = auth.uid()
      and cu.role = 'owner'
  )
  or exists (
    select 1
    from public.project_users pu
    where pu.project_id = estimate_direct_overhead_entries.project_id
      and pu.user_id = auth.uid()
      and pu.role = 'manager'
  )
);
