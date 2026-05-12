create table if not exists public.project_expenses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  category text not null,
  amount numeric(12,2) not null default 0 check (amount >= 0),
  note text,
  expense_date date not null default current_date,
  vendor text,
  payment_method text,
  reference_number text,
  receipt_url text,
  created_by_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_expenses_company_id_idx on public.project_expenses (company_id);
create index if not exists project_expenses_project_id_idx on public.project_expenses (project_id);
create index if not exists project_expenses_created_by_idx on public.project_expenses (created_by_user_id);
create index if not exists project_expenses_date_idx on public.project_expenses (expense_date desc);
create index if not exists project_expenses_category_idx on public.project_expenses (category);

alter table public.project_expenses enable row level security;

drop policy if exists "project_expenses_select_owner_or_project_member" on public.project_expenses;
create policy "project_expenses_select_owner_or_project_member"
on public.project_expenses
for select
to authenticated
using (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = project_expenses.company_id
      and cu.user_id = auth.uid()
      and cu.role = 'owner'
  )
  or exists (
    select 1
    from public.project_users pu
    where pu.project_id = project_expenses.project_id
      and pu.user_id = auth.uid()
  )
);

drop policy if exists "project_expenses_write_project_member" on public.project_expenses;
create policy "project_expenses_write_project_member"
on public.project_expenses
for all
to authenticated
using (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = project_expenses.company_id
      and cu.user_id = auth.uid()
      and cu.role = 'owner'
  )
  or exists (
    select 1
    from public.project_users pu
    where pu.project_id = project_expenses.project_id
      and pu.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = project_expenses.company_id
      and cu.user_id = auth.uid()
      and cu.role = 'owner'
  )
  or exists (
    select 1
    from public.project_users pu
    where pu.project_id = project_expenses.project_id
      and pu.user_id = auth.uid()
  )
);
