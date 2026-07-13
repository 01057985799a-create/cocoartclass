-- Fix: browser (anon key) inserts into lesson_plans were failing.
-- Root cause candidates covered here:
--   1) RLS policies not actually applied (re-created idempotently below).
--   2) Missing table-level GRANTs for anon/authenticated — RLS policies only
--      decide which ROWS are visible/writable; the role still needs the
--      underlying GRANT (INSERT/SELECT/UPDATE/DELETE) on the table itself.
--      A public-schema table created without explicit grants is NOT
--      automatically writable by anon/authenticated in every project setup.

-- ---------------------------------------------------------------------
-- Re-affirm table grants for the anon/authenticated roles
-- ---------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on public.lesson_plans to anon, authenticated;
grant select, insert, update, delete on public.lesson_plan_images to anon, authenticated;

-- ---------------------------------------------------------------------
-- Re-affirm RLS policies (single-user personal tool: allow all for now)
-- ---------------------------------------------------------------------
alter table public.lesson_plans enable row level security;
alter table public.lesson_plan_images enable row level security;

drop policy if exists "Allow all access to lesson_plans" on public.lesson_plans;
create policy "Allow all access to lesson_plans"
  on public.lesson_plans
  for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "Allow all access to lesson_plan_images" on public.lesson_plan_images;
create policy "Allow all access to lesson_plan_images"
  on public.lesson_plan_images
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- ---------------------------------------------------------------------
-- Re-affirm storage.objects policy for the lesson-plan-images bucket
-- ---------------------------------------------------------------------
drop policy if exists "Allow all access to lesson-plan-images" on storage.objects;
create policy "Allow all access to lesson-plan-images"
  on storage.objects
  for all
  to anon, authenticated
  using (bucket_id = 'lesson-plan-images')
  with check (bucket_id = 'lesson-plan-images');
