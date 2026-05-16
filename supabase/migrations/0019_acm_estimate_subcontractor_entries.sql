create table if not exists public.estimate_subcontractor_entries (
  id uuid primary key default gen_random_uuid(),

  estimate_id uuid not null references public.project_estimates (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  cost_code_id uuid references public.cost_codes (id) on delete restrict,
  cost_code_item_id uuid references public.estimate_cost_code_items (id) on delete cascade,

  vendor_id uuid,

  description text,

  amount numeric(14,4) not null default 0,

  workers_comp_percent numeric(8,4) not null default 0,
  workers_comp numeric(14,4) not null default 0,

  liability_percent numeric(8,4) not null default 0,
  liability numeric(14,4) not null default 0,

  overhead_percent numeric(8,4) not null default 0,
  overhead numeric(14,4) not null default 0,

  subtotal numeric(14,4) not null default 0,

  profit_percent numeric(8,4) not null default 0,
  profit numeric(14,4) not null default 0,

  total_cost numeric(14,4) not null default 0,

  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists estimate_subcontractor_entries_estimate_id_idx
  on public.estimate_subcontractor_entries (estimate_id);

create index if not exists estimate_subcontractor_entries_cost_code_id_idx
  on public.estimate_subcontractor_entries (cost_code_id);

create index if not exists estimate_subcontractor_entries_cost_code_item_id_idx
  on public.estimate_subcontractor_entries (cost_code_item_id);

alter table public.estimate_subcontractor_entries enable row level security;

drop policy if exists "estimate_subcontractor_entries_select_company_users" on public.estimate_subcontractor_entries;
create policy "estimate_subcontractor_entries_select_company_users"
on public.estimate_subcontractor_entries
for select
to authenticated
using (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = estimate_subcontractor_entries.company_id
      and cu.user_id = auth.uid()
  )
);

drop policy if exists "estimate_subcontractor_entries_write_company_users" on public.estimate_subcontractor_entries;
create policy "estimate_subcontractor_entries_write_company_users"
on public.estimate_subcontractor_entries
for all
to authenticated
using (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = estimate_subcontractor_entries.company_id
      and cu.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = estimate_subcontractor_entries.company_id
      and cu.user_id = auth.uid()
  )
);
