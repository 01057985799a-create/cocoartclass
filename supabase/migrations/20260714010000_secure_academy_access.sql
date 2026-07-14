-- Restrict all academy data to explicitly allowed authenticated users.

create table if not exists public.academy_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  role text not null default 'teacher' check (role in ('owner', 'teacher')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Preserve access for accounts that already existed before security was enabled.
-- The oldest account becomes owner; other existing accounts become teachers.
insert into public.academy_users (user_id, display_name, role)
select
  id,
  coalesce(raw_user_meta_data ->> 'name', split_part(email, '@', 1), '사용자'),
  case when row_number() over (order by created_at, id) = 1 then 'owner' else 'teacher' end
from auth.users
on conflict (user_id) do nothing;

create or replace function public.is_academy_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.academy_users
    where user_id = auth.uid() and active = true
  );
$$;

revoke all on function public.is_academy_user() from public;
grant execute on function public.is_academy_user() to authenticated;

alter table public.academy_users enable row level security;
drop policy if exists "Academy users can read members" on public.academy_users;
create policy "Academy users can read members" on public.academy_users
  for select to authenticated using (public.is_academy_user());

grant usage on schema public to authenticated;
grant select on public.academy_users to authenticated;
grant select, insert, update, delete on public.lesson_plans to authenticated;
grant select, insert, update, delete on public.lesson_plan_images to authenticated;
grant select, insert, update, delete on public.classes to authenticated;
grant select, insert, update, delete on public.students to authenticated;
grant select, insert, update, delete on public.class_enrollments to authenticated;

revoke all on public.lesson_plans from anon;
revoke all on public.lesson_plan_images from anon;
revoke all on public.classes from anon;
revoke all on public.students from anon;
revoke all on public.class_enrollments from anon;
revoke all on public.academy_users from anon;

drop policy if exists "Allow all access to lesson_plans" on public.lesson_plans;
create policy "Academy access to lesson_plans" on public.lesson_plans
  for all to authenticated using (public.is_academy_user()) with check (public.is_academy_user());

drop policy if exists "Allow all access to lesson_plan_images" on public.lesson_plan_images;
create policy "Academy access to lesson_plan_images" on public.lesson_plan_images
  for all to authenticated using (public.is_academy_user()) with check (public.is_academy_user());

drop policy if exists "Allow all access to classes" on public.classes;
create policy "Academy access to classes" on public.classes
  for all to authenticated using (public.is_academy_user()) with check (public.is_academy_user());

drop policy if exists "Allow all access to students" on public.students;
create policy "Academy access to students" on public.students
  for all to authenticated using (public.is_academy_user()) with check (public.is_academy_user());

drop policy if exists "Allow all access to class_enrollments" on public.class_enrollments;
create policy "Academy access to class_enrollments" on public.class_enrollments
  for all to authenticated using (public.is_academy_user()) with check (public.is_academy_user());

update storage.buckets set public = false where id = 'lesson-plan-images';
drop policy if exists "Allow all access to lesson-plan-images" on storage.objects;
create policy "Academy access to lesson-plan-images" on storage.objects
  for all to authenticated
  using (bucket_id = 'lesson-plan-images' and public.is_academy_user())
  with check (bucket_id = 'lesson-plan-images' and public.is_academy_user());
