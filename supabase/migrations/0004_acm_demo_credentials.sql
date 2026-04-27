create table if not exists public.demo_user_credentials (
  user_id uuid primary key references auth.users (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  email citext not null,
  password text not null,
  password_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists demo_user_credentials_company_id_idx
  on public.demo_user_credentials (company_id);

alter table public.demo_user_credentials enable row level security;

drop policy if exists "demo_user_credentials_select_owner_only" on public.demo_user_credentials;
create policy "demo_user_credentials_select_owner_only"
on public.demo_user_credentials
for select
to authenticated
using (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = demo_user_credentials.company_id
      and cu.user_id = auth.uid()
      and cu.role = 'owner'
  )
);
