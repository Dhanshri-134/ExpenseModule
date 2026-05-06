alter table public.companies
  add column if not exists metadata jsonb not null default '{}'::jsonb;
