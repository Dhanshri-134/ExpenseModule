create table if not exists public.estimate_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  template_kind text not null default 'standard',
  configuration jsonb not null default '{}'::jsonb,
  created_by_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists estimate_templates_company_id_idx on public.estimate_templates (company_id);
create unique index if not exists estimate_templates_one_default_per_company_idx
  on public.estimate_templates (company_id)
  where is_default = true;

alter table public.estimate_templates enable row level security;

drop policy if exists "estimate_templates_select_company_users" on public.estimate_templates;
create policy "estimate_templates_select_company_users"
on public.estimate_templates
for select
to authenticated
using (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = estimate_templates.company_id
      and cu.user_id = auth.uid()
  )
);

drop policy if exists "estimate_templates_write_company_users" on public.estimate_templates;
create policy "estimate_templates_write_company_users"
on public.estimate_templates
for all
to authenticated
using (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = estimate_templates.company_id
      and cu.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = estimate_templates.company_id
      and cu.user_id = auth.uid()
  )
);

alter table public.project_estimates
  alter column project_id drop not null,
  add column if not exists client_id uuid references public.clients (id) on delete set null,
  add column if not exists template_id uuid references public.estimate_templates (id) on delete set null,
  add column if not exists approval_status text not null default 'draft',
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by_user_id uuid references auth.users (id) on delete set null,
  add column if not exists invoice_status text not null default 'not_started',
  add column if not exists invoice_reference text,
  add column if not exists invoice_completed_at timestamptz,
  add column if not exists created_project_id uuid references public.projects (id) on delete set null;

drop index if exists project_estimates_project_id_idx;
create index if not exists project_estimates_project_id_idx on public.project_estimates (project_id);
create index if not exists project_estimates_client_id_idx on public.project_estimates (client_id);
create index if not exists project_estimates_template_id_idx on public.project_estimates (template_id);

drop index if exists project_estimates_scenario_idx;
create index if not exists project_estimates_scope_status_idx
  on public.project_estimates (company_id, client_id, project_id, estimate_number desc);

alter table public.estimate_cost_code_items alter column project_id drop not null;
alter table public.estimate_labor_rates alter column project_id drop not null;
alter table public.estimate_labor_entries alter column project_id drop not null;
alter table public.estimate_material_entries alter column project_id drop not null;
alter table public.estimate_equipment_entries alter column project_id drop not null;
alter table public.estimate_direct_overhead_entries alter column project_id drop not null;

drop policy if exists "project_estimates_select_owner_or_project_member" on public.project_estimates;
create policy "project_estimates_select_company_users"
on public.project_estimates
for select
to authenticated
using (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = project_estimates.company_id
      and cu.user_id = auth.uid()
  )
);

drop policy if exists "project_estimates_write_owner_or_manager" on public.project_estimates;
create policy "project_estimates_write_company_users"
on public.project_estimates
for all
to authenticated
using (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = project_estimates.company_id
      and cu.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = project_estimates.company_id
      and cu.user_id = auth.uid()
  )
);

drop policy if exists "estimate_cost_code_items_select_owner_or_project_member" on public.estimate_cost_code_items;
create policy "estimate_cost_code_items_select_company_users"
on public.estimate_cost_code_items
for select
to authenticated
using (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = estimate_cost_code_items.company_id
      and cu.user_id = auth.uid()
  )
);

drop policy if exists "estimate_cost_code_items_write_owner_or_manager" on public.estimate_cost_code_items;
create policy "estimate_cost_code_items_write_company_users"
on public.estimate_cost_code_items
for all
to authenticated
using (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = estimate_cost_code_items.company_id
      and cu.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = estimate_cost_code_items.company_id
      and cu.user_id = auth.uid()
  )
);

drop policy if exists "estimate_labor_rates_select_owner_or_project_member" on public.estimate_labor_rates;
create policy "estimate_labor_rates_select_company_users"
on public.estimate_labor_rates
for select
to authenticated
using (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = estimate_labor_rates.company_id
      and cu.user_id = auth.uid()
  )
);

drop policy if exists "estimate_labor_rates_write_owner_or_manager" on public.estimate_labor_rates;
create policy "estimate_labor_rates_write_company_users"
on public.estimate_labor_rates
for all
to authenticated
using (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = estimate_labor_rates.company_id
      and cu.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = estimate_labor_rates.company_id
      and cu.user_id = auth.uid()
  )
);

drop policy if exists "estimate_labor_entries_select_owner_or_project_member" on public.estimate_labor_entries;
create policy "estimate_labor_entries_select_company_users"
on public.estimate_labor_entries
for select
to authenticated
using (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = estimate_labor_entries.company_id
      and cu.user_id = auth.uid()
  )
);

drop policy if exists "estimate_labor_entries_write_owner_or_manager" on public.estimate_labor_entries;
create policy "estimate_labor_entries_write_company_users"
on public.estimate_labor_entries
for all
to authenticated
using (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = estimate_labor_entries.company_id
      and cu.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = estimate_labor_entries.company_id
      and cu.user_id = auth.uid()
  )
);

drop policy if exists "estimate_material_entries_select_owner_or_project_member" on public.estimate_material_entries;
create policy "estimate_material_entries_select_company_users"
on public.estimate_material_entries
for select
to authenticated
using (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = estimate_material_entries.company_id
      and cu.user_id = auth.uid()
  )
);

drop policy if exists "estimate_material_entries_write_owner_or_manager" on public.estimate_material_entries;
create policy "estimate_material_entries_write_company_users"
on public.estimate_material_entries
for all
to authenticated
using (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = estimate_material_entries.company_id
      and cu.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = estimate_material_entries.company_id
      and cu.user_id = auth.uid()
  )
);

drop policy if exists "estimate_equipment_entries_select_owner_or_project_member" on public.estimate_equipment_entries;
create policy "estimate_equipment_entries_select_company_users"
on public.estimate_equipment_entries
for select
to authenticated
using (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = estimate_equipment_entries.company_id
      and cu.user_id = auth.uid()
  )
);

drop policy if exists "estimate_equipment_entries_write_owner_or_manager" on public.estimate_equipment_entries;
create policy "estimate_equipment_entries_write_company_users"
on public.estimate_equipment_entries
for all
to authenticated
using (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = estimate_equipment_entries.company_id
      and cu.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = estimate_equipment_entries.company_id
      and cu.user_id = auth.uid()
  )
);

drop policy if exists "estimate_direct_overhead_entries_select_owner_or_project_member" on public.estimate_direct_overhead_entries;
create policy "estimate_direct_overhead_entries_select_company_users"
on public.estimate_direct_overhead_entries
for select
to authenticated
using (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = estimate_direct_overhead_entries.company_id
      and cu.user_id = auth.uid()
  )
);

drop policy if exists "estimate_direct_overhead_entries_write_owner_or_manager" on public.estimate_direct_overhead_entries;
create policy "estimate_direct_overhead_entries_write_company_users"
on public.estimate_direct_overhead_entries
for all
to authenticated
using (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = estimate_direct_overhead_entries.company_id
      and cu.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = estimate_direct_overhead_entries.company_id
      and cu.user_id = auth.uid()
  )
);
