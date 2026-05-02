-- ACM Desk - User Name support + immutable User ID
-- Run after: 0005_acm_task_workflow_upgrade.sql

alter table public.company_users
  add column if not exists user_name text;

update public.company_users
set user_name = user_code
where coalesce(nullif(trim(user_name), ''), '') = ''
  and coalesce(nullif(trim(user_code), ''), '') <> '';

alter table public.company_users
  alter column user_name set not null;

create unique index if not exists company_users_user_name_ux
  on public.company_users (lower(user_name));

create or replace function public.acm_company_users_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_code text;
  v_role_num int;
  v_creator_role public.acm_role;
  v_creator_role_num int;
begin
  if new.created_by_user_id is null then
    new.created_by_user_id := auth.uid();
  end if;

  select code into v_company_code from public.companies where id = new.company_id;
  if v_company_code is null then
    raise exception 'Invalid company_id';
  end if;

  if new.role_number is null then
    v_role_num := public.acm_next_role_number(new.company_id, new.role);
    new.role_number := v_role_num;
  else
    v_role_num := new.role_number;
  end if;

  if new.role = 'employee' and new.created_by_user_id is not null then
    select cu.role, cu.role_number
      into v_creator_role, v_creator_role_num
    from public.company_users cu
    where cu.company_id = new.company_id
      and cu.user_id = new.created_by_user_id
    limit 1;

    if v_creator_role = 'manager' and v_creator_role_num is not null then
      if new.created_in_project_id is null then
        raise exception 'Manager-created employees must include created_in_project_id';
      end if;
      new.user_code := v_company_code || '-M' || v_creator_role_num::text || '-E-' || lpad(v_role_num::text, 3, '0');
    end if;
  end if;

  if new.user_code is null then
    if new.role = 'owner' then
      new.user_code := v_company_code || '-O-001';
    elsif new.role = 'manager' then
      new.user_code := v_company_code || '-M-' || lpad(v_role_num::text, 3, '0');
    else
      new.user_code := v_company_code || '-E-' || lpad(v_role_num::text, 3, '0');
    end if;
  end if;

  if new.user_name is null or length(trim(new.user_name)) = 0 then
    new.user_name := new.user_code;
  end if;

  return new;
end $$;
