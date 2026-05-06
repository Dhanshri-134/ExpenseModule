alter table public.estimate_labor_entries
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.estimate_material_entries
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.estimate_equipment_entries
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.estimate_direct_overhead_entries
  add column if not exists metadata jsonb not null default '{}'::jsonb;
