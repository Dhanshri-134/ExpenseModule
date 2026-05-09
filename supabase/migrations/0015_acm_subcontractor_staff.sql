do $$
begin
  if exists (
    select 1
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'acm_role' and e.enumlabel = 'subcontractor'
  ) then
    null;
  else
    alter type public.acm_role add value 'subcontractor';
  end if;
end $$;

alter table public.company_users
  add column if not exists craft text;
