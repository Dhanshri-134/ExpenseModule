create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'acm_followup_ref_type') then
    create type public.acm_followup_ref_type as enum ('lead', 'client', 'task');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'acm_followup_status') then
    create type public.acm_followup_status as enum ('pending', 'done');
  end if;
end $$;

create table if not exists public.followups (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  ref_id uuid not null,
  ref_type public.acm_followup_ref_type not null,
  date date not null,
  note text not null,
  status public.acm_followup_status not null default 'pending',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists followups_company_id_idx on public.followups (company_id);
create index if not exists followups_ref_idx on public.followups (ref_type, ref_id);
create index if not exists followups_date_idx on public.followups (date);
create index if not exists followups_status_idx on public.followups (status);
create index if not exists followups_created_by_idx on public.followups (created_by);

alter table public.followups enable row level security;

insert into public.followups (
  company_id,
  ref_id,
  ref_type,
  date,
  note,
  status,
  created_by,
  created_at,
  updated_at
)
select
  lfu.company_id,
  lfu.lead_id,
  'lead'::public.acm_followup_ref_type,
  coalesce(lfu.next_follow_up_date, lfu.created_at::date),
  lfu.note,
  'pending'::public.acm_followup_status,
  lfu.created_by_user_id,
  lfu.created_at,
  lfu.updated_at
from public.lead_follow_ups lfu
where not exists (
  select 1
  from public.followups f
  where f.ref_type = 'lead'::public.acm_followup_ref_type
    and f.ref_id = lfu.lead_id
    and f.note = lfu.note
    and f.created_at = lfu.created_at
);

alter table public.tasks
  add column if not exists status public.acm_task_assignment_status not null default 'assigned';

update public.tasks t
set status = coalesce(agg.status, t.status, 'assigned'::public.acm_task_assignment_status)
from (
  select
    ta.task_id,
    case
      when bool_or(ta.status = 'rejected') then 'rejected'::public.acm_task_assignment_status
      when bool_and(ta.status = 'approved') then 'approved'::public.acm_task_assignment_status
      when bool_or(ta.status = 'submitted') then 'submitted'::public.acm_task_assignment_status
      else 'assigned'::public.acm_task_assignment_status
    end as status
  from public.task_assignments ta
  group by ta.task_id
) agg
where agg.task_id = t.id;

drop policy if exists "followups_select_owner_or_project_member" on public.followups;
create policy "followups_select_owner_or_project_member"
on public.followups
for select
to authenticated
using (
  exists (
    select 1
    from public.company_users cu
    where cu.company_id = followups.company_id
      and cu.user_id = auth.uid()
      and cu.role = 'owner'
  )
  or (
    followups.ref_type = 'task'::public.acm_followup_ref_type
    and exists (
      select 1
      from public.tasks t
      join public.project_users pu on pu.project_id = t.project_id
      where t.id = followups.ref_id
        and pu.user_id = auth.uid()
    )
  )
);
