create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  invoice_number int not null,
  title text not null default 'Invoice',
  invoice_reference text,
  invoice_date date not null default current_date,
  valid_until date,
  status text not null default 'draft',
  notes text,
  line_items jsonb not null default '[]'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  created_by_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, invoice_number)
);

create index if not exists invoices_company_id_idx on public.invoices (company_id);
create index if not exists invoices_client_id_idx on public.invoices (client_id);
create index if not exists invoices_project_id_idx on public.invoices (project_id);
create index if not exists invoices_status_idx on public.invoices (company_id, status, invoice_date desc);

alter table public.invoices enable row level security;

drop policy if exists "invoices_select_company_member" on public.invoices;
create policy "invoices_select_company_member"
on public.invoices
for select
to authenticated
using (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = invoices.company_id
      and cu.user_id = auth.uid()
  )
);

drop policy if exists "invoices_write_company_member" on public.invoices;
create policy "invoices_write_company_member"
on public.invoices
for all
to authenticated
using (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = invoices.company_id
      and cu.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = invoices.company_id
      and cu.user_id = auth.uid()
  )
);
