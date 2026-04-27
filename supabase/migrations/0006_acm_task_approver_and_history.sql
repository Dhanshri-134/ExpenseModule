alter table public.tasks
  add column if not exists approver_user_id uuid references auth.users (id) on delete set null;

create index if not exists tasks_approver_user_id_idx on public.tasks (approver_user_id);
