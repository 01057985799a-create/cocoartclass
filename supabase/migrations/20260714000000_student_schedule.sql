-- Student search, class capacity, and weekly schedule

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  day_of_week integer not null check (day_of_week between 1 and 6),
  start_time time not null,
  end_time time not null,
  age_group text not null check (age_group in ('유치부', '초등 저학년', '초등 고학년', '중고등')),
  capacity integer not null check (capacity > 0),
  teacher_name text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (day_of_week, start_time, name)
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  birth_date date,
  school_name text,
  guardian_name text,
  guardian_phone text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.class_enrollments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (class_id, student_id)
);

create index if not exists classes_schedule_idx on public.classes (day_of_week, start_time);
create index if not exists students_name_idx on public.students (name);
create index if not exists class_enrollments_class_id_idx on public.class_enrollments (class_id);
create index if not exists class_enrollments_student_id_idx on public.class_enrollments (student_id);

drop trigger if exists set_classes_updated_at on public.classes;
create trigger set_classes_updated_at before update on public.classes
  for each row execute function public.set_updated_at();

drop trigger if exists set_students_updated_at on public.students;
create trigger set_students_updated_at before update on public.students
  for each row execute function public.set_updated_at();

alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.class_enrollments enable row level security;

drop policy if exists "Allow all access to classes" on public.classes;
create policy "Allow all access to classes" on public.classes
  for all using (true) with check (true);
drop policy if exists "Allow all access to students" on public.students;
create policy "Allow all access to students" on public.students
  for all using (true) with check (true);
drop policy if exists "Allow all access to class_enrollments" on public.class_enrollments;
create policy "Allow all access to class_enrollments" on public.class_enrollments
  for all using (true) with check (true);
