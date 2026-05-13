alter table public.project_expenses
  add column if not exists expense_type text not null default 'material',
  add column if not exists status text not null default 'approved',
  add column if not exists party_name text,
  add column if not exists quantity numeric(12,2) not null default 0,
  add column if not exists unit_rate numeric(12,2) not null default 0,
  add column if not exists markup_percent numeric(8,2) not null default 0,
  add column if not exists details jsonb not null default '{}'::jsonb;

alter table public.project_expenses
  drop constraint if exists project_expenses_expense_type_check;

alter table public.project_expenses
  add constraint project_expenses_expense_type_check
  check (expense_type in ('employee_labor', 'subcontractor', 'material', 'equipment'));

alter table public.project_expenses
  drop constraint if exists project_expenses_status_check;

alter table public.project_expenses
  add constraint project_expenses_status_check
  check (status in ('pending', 'approved', 'paid'));

create index if not exists project_expenses_type_idx on public.project_expenses (expense_type);
create index if not exists project_expenses_status_idx on public.project_expenses (status);
