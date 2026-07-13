-- Initial schema for art-class-ai
-- Single-user personal tool: no academy/member/user separation, RLS is
-- enabled but set to allow-all for now. Tighten these policies once
-- login is added.

-- ---------------------------------------------------------------------
-- lesson_plans
-- ---------------------------------------------------------------------
create table if not exists public.lesson_plans (
  id uuid primary key default gen_random_uuid(),
  title text,
  reference_image_urls text[],
  target_age text,
  class_type text,
  class_minutes integer,
  session_count integer,
  additional_request text,
  image_analysis jsonb,
  generated_plan jsonb,
  final_plan jsonb,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- keep updated_at current on every update
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_lesson_plans_updated_at on public.lesson_plans;
create trigger set_lesson_plans_updated_at
  before update on public.lesson_plans
  for each row
  execute function public.set_updated_at();

alter table public.lesson_plans enable row level security;

drop policy if exists "Allow all access to lesson_plans" on public.lesson_plans;
create policy "Allow all access to lesson_plans"
  on public.lesson_plans
  for all
  using (true)
  with check (true);

-- ---------------------------------------------------------------------
-- lesson_plan_images
-- ---------------------------------------------------------------------
create table if not exists public.lesson_plan_images (
  id uuid primary key default gen_random_uuid(),
  lesson_plan_id uuid not null references public.lesson_plans (id) on delete cascade,
  storage_path text,
  image_order integer,
  original_filename text,
  created_at timestamptz not null default now()
);

create index if not exists lesson_plan_images_lesson_plan_id_idx
  on public.lesson_plan_images (lesson_plan_id);

alter table public.lesson_plan_images enable row level security;

drop policy if exists "Allow all access to lesson_plan_images" on public.lesson_plan_images;
create policy "Allow all access to lesson_plan_images"
  on public.lesson_plan_images
  for all
  using (true)
  with check (true);

-- ---------------------------------------------------------------------
-- Storage bucket for reference / lesson plan images
-- Objects are stored as "{lesson_plan_id}/{filename}"
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('lesson-plan-images', 'lesson-plan-images', true)
on conflict (id) do nothing;

drop policy if exists "Allow all access to lesson-plan-images" on storage.objects;
create policy "Allow all access to lesson-plan-images"
  on storage.objects
  for all
  using (bucket_id = 'lesson-plan-images')
  with check (bucket_id = 'lesson-plan-images');
