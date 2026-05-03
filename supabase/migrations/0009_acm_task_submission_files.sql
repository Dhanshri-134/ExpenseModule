alter table public.task_submissions
  add column if not exists files jsonb not null default '[]'::jsonb;

update public.task_submissions
set files = coalesce(
  (
    select jsonb_agg(
      jsonb_build_object(
        'name', concat('File ', item.ordinality),
        'type', 'image/*',
        'size', null,
        'dataUrl', item.value
      )
    )
    from jsonb_array_elements_text(coalesce(photos, '[]'::jsonb)) with ordinality as item(value, ordinality)
  ),
  '[]'::jsonb
)
where files = '[]'::jsonb
  and coalesce(jsonb_array_length(photos), 0) > 0;
