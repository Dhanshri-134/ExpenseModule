# Supabase queries (Phase 1) – Staff IDs, Projects, Restrictions

Run these migrations in Supabase SQL editor (in order):

1. `apps/web/supabase/migrations/0001_acm_phase1_schema.sql`
2. `apps/web/supabase/migrations/0002_acm_staff_project_rules.sql`

## What you get

- **User ID format** (stored in `company_users.user_code`)
  - Manager: `ACM-M-001`
  - Employee (created by Owner): `ACM-E-001`
  - Employee (created by Manager #1): `ACM-M1-E-001` (requires `created_in_project_id`)
- **Job Number format** (stored in `projects.job_number`)
  - `ACM-2026-001`, `ACM-2026-002`…
  - Auto-generated, unique, and cannot be edited after creation.
- **Strict access (RLS)**
  - Owner can see all company projects.
  - Manager/Employee can only see projects they are assigned to in `project_users`.
  - Manager can create employees only inside their assigned project.

## Seed examples (after users exist in Auth)

Create a company (Owner UID must already exist in `auth.users`):

```sql
insert into public.companies (name, code, owner_user_id)
values ('ACM Constructions', 'ACM', '<OWNER_AUTH_UID>');
```

Register Owner membership (required for RLS):

```sql
insert into public.company_users (company_id, user_id, role)
values ('<COMPANY_UUID>', '<OWNER_AUTH_UID>', 'owner');
```

If you already created a company row but login says “not registered as Owner”, backfill the membership row from `companies.owner_user_id`:

```sql
insert into public.company_users (company_id, user_id, role)
select c.id, c.owner_user_id, 'owner'
from public.companies c
where c.owner_user_id is not null
  and not exists (
    select 1 from public.company_users cu
    where cu.company_id = c.id
      and cu.user_id = c.owner_user_id
      and cu.role = 'owner'
  );
```

Create a project (Job Number auto-generates):

```sql
insert into public.projects (company_id, name, location, contract_value, start_date)
values ('<COMPANY_UUID>', 'Project Alpha', 'Pune', 12000000, '2026-04-25');
```

Assign a Manager to a project:

```sql
insert into public.project_users (project_id, user_id, role, hourly_rate)
values ('<PROJECT_UUID>', '<MANAGER_AUTH_UID>', 'manager', 850);
```

Assign an Employee to a project:

```sql
insert into public.project_users (project_id, user_id, role, hourly_rate)
values ('<PROJECT_UUID>', '<EMP_AUTH_UID>', 'employee', 450);
```

To generate `ACM-M1-E-001` for a manager-created employee, insert their `company_users` row with `created_in_project_id` and `created_by_user_id` set to that manager.
