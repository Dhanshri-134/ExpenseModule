create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'acm_task_status') then
    create type public.acm_task_status as enum ('assigned', 'submitted', 'completed');
  end if;
end $$;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  assigned_to_user_id uuid not null references auth.users (id) on delete cascade,
  assigned_to_role public.acm_role not null,
  title text not null,
  description text,
  due_date date,
  status public.acm_task_status not null default 'assigned',
  assigned_by_user_id uuid not null references auth.users (id) on delete restrict,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_company_id_idx on public.tasks (company_id);
create index if not exists tasks_project_id_idx on public.tasks (project_id);
create index if not exists tasks_assigned_to_user_id_idx on public.tasks (assigned_to_user_id);
create index if not exists tasks_status_idx on public.tasks (status);

alter table public.tasks enable row level security;

drop policy if exists "tasks_select_owner_or_project_member" on public.tasks;
create policy "tasks_select_owner_or_project_member"
on public.tasks
for select
to authenticated
using (
  assigned_to_user_id = auth.uid()
  or exists (
    select 1
    from public.company_users cu
    where cu.company_id = tasks.company_id
      and cu.user_id = auth.uid()
      and cu.role = 'owner'
  )
  or exists (
    select 1
    from public.project_users pu
    where pu.project_id = tasks.project_id
      and pu.user_id = auth.uid()
  )
);
