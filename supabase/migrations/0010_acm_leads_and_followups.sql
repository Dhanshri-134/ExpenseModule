create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  address text not null,
  contact text not null,
  email citext not null,
  status text not null default 'open' check (status in ('open', 'converted')),
  converted_client_id uuid references public.clients (id) on delete set null,
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_company_id_idx on public.leads (company_id);
create index if not exists leads_status_idx on public.leads (status);

create table if not exists public.lead_follow_ups (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  note text not null,
  next_follow_up_date date,
  created_by_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lead_follow_ups_lead_id_idx on public.lead_follow_ups (lead_id);
create index if not exists lead_follow_ups_company_id_idx on public.lead_follow_ups (company_id);
