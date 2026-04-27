create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'acm_task_assignment_status') then
    create type public.acm_task_assignment_status as enum ('assigned', 'submitted', 'approved', 'rejected');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'acm_task_review_action') then
    create type public.acm_task_review_action as enum ('approved', 'rejected');
  end if;
end $$;

drop policy if exists "tasks_select_owner_or_project_member" on public.tasks;

alter table public.project_users
  add column if not exists id uuid;

update public.project_users
set id = gen_random_uuid()
where id is null;

alter table public.project_users
  alter column id set default gen_random_uuid(),
  alter column id set not null;

do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'project_users'
      and constraint_name = 'project_users_pkey'
  ) then
    alter table public.project_users drop constraint project_users_pkey;
  end if;
exception
  when undefined_object then null;
end $$;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'project_users'
      and constraint_name = 'project_users_pkey'
  ) then
    alter table public.project_users add constraint project_users_pkey primary key (id);
  end if;
end $$;

create unique index if not exists project_users_project_user_ux
  on public.project_users (project_id, user_id);

alter table public.tasks
  add column if not exists start_date date,
  add column if not exists end_date date,
  add column if not exists approval_role public.acm_project_role,
  add column if not exists created_by uuid references auth.users (id) on delete set null;

update public.tasks
set
  start_date = coalesce(start_date, created_at::date),
  end_date = coalesce(end_date, due_date),
  approval_role = coalesce(
    approval_role,
    case
      when assigned_to_role::text = 'manager' then 'manager'::public.acm_project_role
      else 'employee'::public.acm_project_role
    end
  ),
  created_by = coalesce(created_by, assigned_by_user_id);

alter table public.tasks
  alter column start_date set not null,
  alter column approval_role set not null,
  alter column created_by set not null;

create table if not exists public.task_assignments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.acm_project_role not null,
  assigned_by_user_id uuid not null references auth.users (id) on delete restrict,
  status public.acm_task_assignment_status not null default 'assigned',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (task_id, user_id)
);

create index if not exists task_assignments_task_id_idx on public.task_assignments (task_id);
create index if not exists task_assignments_project_id_idx on public.task_assignments (project_id);
create index if not exists task_assignments_user_id_idx on public.task_assignments (user_id);
create index if not exists task_assignments_status_idx on public.task_assignments (status);

alter table public.task_assignments enable row level security;

insert into public.task_assignments (
  task_id,
  project_id,
  user_id,
  role,
  assigned_by_user_id,
  status,
  created_at,
  updated_at
)
select
  t.id,
  t.project_id,
  t.assigned_to_user_id,
  case
    when t.assigned_to_role::text = 'manager' then 'manager'::public.acm_project_role
    else 'employee'::public.acm_project_role
  end,
  coalesce(t.assigned_by_user_id, t.created_by),
  case
    when t.status::text = 'completed' then 'approved'::public.acm_task_assignment_status
    when t.status::text = 'submitted' then 'submitted'::public.acm_task_assignment_status
    else 'assigned'::public.acm_task_assignment_status
  end,
  t.created_at,
  coalesce(t.submitted_at, t.updated_at, t.created_at)
from public.tasks t
where t.assigned_to_user_id is not null
on conflict (task_id, user_id) do update
set
  role = excluded.role,
  assigned_by_user_id = excluded.assigned_by_user_id,
  status = excluded.status,
  updated_at = excluded.updated_at;

create table if not exists public.task_submissions (
  id uuid primary key default gen_random_uuid(),
  task_assignment_id uuid not null references public.task_assignments (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  submitted_by_user_id uuid not null references auth.users (id) on delete restrict,
  work_description text not null,
  photos jsonb not null default '[]'::jsonb,
  blocker text,
  created_at timestamptz not null default now()
);

create index if not exists task_submissions_assignment_id_idx on public.task_submissions (task_assignment_id);
create index if not exists task_submissions_task_id_idx on public.task_submissions (task_id);
create index if not exists task_submissions_project_id_idx on public.task_submissions (project_id);

alter table public.task_submissions enable row level security;

create table if not exists public.task_approvals (
  id uuid primary key default gen_random_uuid(),
  task_submission_id uuid not null references public.task_submissions (id) on delete cascade,
  task_assignment_id uuid not null references public.task_assignments (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  action public.acm_task_review_action not null,
  comment text,
  approved_by_user_id uuid not null references auth.users (id) on delete restrict,
  approved_by_role public.acm_project_role not null,
  created_at timestamptz not null default now()
);

create index if not exists task_approvals_submission_id_idx on public.task_approvals (task_submission_id);
create index if not exists task_approvals_assignment_id_idx on public.task_approvals (task_assignment_id);
create index if not exists task_approvals_approved_by_user_id_idx on public.task_approvals (approved_by_user_id);

alter table public.task_approvals enable row level security;

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete cascade,
  actor_user_id uuid references auth.users (id) on delete set null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_logs_company_id_idx on public.activity_logs (company_id);
create index if not exists activity_logs_project_id_idx on public.activity_logs (project_id);
create index if not exists activity_logs_task_id_idx on public.activity_logs (task_id);

alter table public.activity_logs enable row level security;

insert into public.task_submissions (
  task_assignment_id,
  task_id,
  project_id,
  submitted_by_user_id,
  work_description,
  photos,
  blocker,
  created_at
)
select
  ta.id,
  t.id,
  t.project_id,
  t.assigned_to_user_id,
  'Migrated existing submitted task state',
  '[]'::jsonb,
  null,
  coalesce(t.submitted_at, t.updated_at, t.created_at)
from public.tasks t
join public.task_assignments ta
  on ta.task_id = t.id
 and ta.user_id = t.assigned_to_user_id
where t.submitted_at is not null
  and not exists (
    select 1
    from public.task_submissions ts
    where ts.task_assignment_id = ta.id
  );

insert into public.task_approvals (
  task_submission_id,
  task_assignment_id,
  task_id,
  project_id,
  action,
  comment,
  approved_by_user_id,
  approved_by_role,
  created_at
)
select
  ts.id,
  ta.id,
  t.id,
  t.project_id,
  'approved'::public.acm_task_review_action,
  'Migrated existing completed task state',
  coalesce(t.created_by, ta.assigned_by_user_id),
  t.approval_role,
  coalesce(t.updated_at, t.created_at)
from public.tasks t
join public.task_assignments ta
  on ta.task_id = t.id
 and ta.user_id = t.assigned_to_user_id
join public.task_submissions ts
  on ts.task_assignment_id = ta.id
where t.status::text = 'completed'
  and not exists (
    select 1
    from public.task_approvals tap
    where tap.task_assignment_id = ta.id
  );

alter table public.tasks
  drop column if exists assigned_to_user_id,
  drop column if exists assigned_to_role,
  drop column if exists status,
  drop column if exists assigned_by_user_id,
  drop column if exists submitted_at,
  drop column if exists due_date;

drop policy if exists "tasks_select_owner_or_project_member_v2" on public.tasks;
create policy "tasks_select_owner_or_project_member_v2"
on public.tasks
for select
to authenticated
using (
  exists (
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

drop policy if exists "task_assignments_select_owner_or_project_member" on public.task_assignments;
create policy "task_assignments_select_owner_or_project_member"
on public.task_assignments
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.tasks t
    join public.company_users cu on cu.company_id = t.company_id
    where t.id = task_assignments.task_id
      and cu.user_id = auth.uid()
      and cu.role = 'owner'
  )
  or exists (
    select 1
    from public.project_users pu
    where pu.project_id = task_assignments.project_id
      and pu.user_id = auth.uid()
  )
);

drop policy if exists "task_submissions_select_owner_or_project_member" on public.task_submissions;
create policy "task_submissions_select_owner_or_project_member"
on public.task_submissions
for select
to authenticated
using (
  submitted_by_user_id = auth.uid()
  or exists (
    select 1
    from public.tasks t
    join public.company_users cu on cu.company_id = t.company_id
    where t.id = task_submissions.task_id
      and cu.user_id = auth.uid()
      and cu.role = 'owner'
  )
  or exists (
    select 1
    from public.project_users pu
    where pu.project_id = task_submissions.project_id
      and pu.user_id = auth.uid()
  )
);

drop policy if exists "task_approvals_select_owner_or_project_member" on public.task_approvals;
create policy "task_approvals_select_owner_or_project_member"
on public.task_approvals
for select
to authenticated
using (
  approved_by_user_id = auth.uid()
  or exists (
    select 1
    from public.tasks t
    join public.company_users cu on cu.company_id = t.company_id
    where t.id = task_approvals.task_id
      and cu.user_id = auth.uid()
      and cu.role = 'owner'
  )
  or exists (
    select 1
    from public.project_users pu
    where pu.project_id = task_approvals.project_id
      and pu.user_id = auth.uid()
  )
);

drop policy if exists "activity_logs_select_owner_or_project_member" on public.activity_logs;
create policy "activity_logs_select_owner_or_project_member"
on public.activity_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = activity_logs.company_id
      and cu.user_id = auth.uid()
      and cu.role = 'owner'
  )
  or (
    activity_logs.project_id is not null
    and exists (
      select 1
      from public.project_users pu
      where pu.project_id = activity_logs.project_id
        and pu.user_id = auth.uid()
    )
  )
);
