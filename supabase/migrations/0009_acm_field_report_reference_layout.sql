alter table public.field_reports
  add column if not exists temperature_value numeric(10,2),
  add column if not exists temperature_unit text,
  add column if not exists public_communications jsonb not null default '[]'::jsonb,
  add column if not exists contractor_labor_force jsonb not null default '[]'::jsonb,
  add column if not exists subcontractors_onsite jsonb not null default '[]'::jsonb,
  add column if not exists equipment_used jsonb not null default '[]'::jsonb,
  add column if not exists materials_used jsonb not null default '[]'::jsonb;
