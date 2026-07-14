-- Monthly class calendars, closures, attendance and make-up lessons.
-- Existing class/student/enrollment tables remain unchanged.

alter table public.class_enrollments
  add column if not exists uses_vehicle boolean not null default false;

create table if not exists public.academy_closures (
  id uuid primary key default gen_random_uuid(),
  closure_date date not null unique,
  name text not null,
  closure_type text not null check (closure_type in ('holiday', 'vacation')),
  created_at timestamptz not null default now()
);

create table if not exists public.lesson_sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  lesson_date date not null,
  session_number integer not null check (session_number between 1 and 4),
  is_makeup boolean not null default false,
  created_at timestamptz not null default now(),
  unique (class_id, lesson_date)
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  lesson_session_id uuid not null references public.lesson_sessions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  status text not null default 'scheduled' check (status in ('scheduled', 'present', 'absent', 'makeup')),
  makeup_session_id uuid references public.lesson_sessions(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lesson_session_id, student_id)
);

create index if not exists lesson_sessions_date_idx on public.lesson_sessions(lesson_date, class_id);
create index if not exists attendance_student_idx on public.attendance(student_id, status);

drop trigger if exists set_attendance_updated_at on public.attendance;
create trigger set_attendance_updated_at before update on public.attendance
  for each row execute function public.set_updated_at();

alter table public.academy_closures enable row level security;
alter table public.lesson_sessions enable row level security;
alter table public.attendance enable row level security;

grant select, insert, update, delete on public.academy_closures to authenticated;
grant select, insert, update, delete on public.lesson_sessions to authenticated;
grant select, insert, update, delete on public.attendance to authenticated;
revoke all on public.academy_closures from anon;
revoke all on public.lesson_sessions from anon;
revoke all on public.attendance from anon;

create policy "Academy access to closures" on public.academy_closures
  for all to authenticated using (public.is_academy_user()) with check (public.is_academy_user());
create policy "Academy access to lesson sessions" on public.lesson_sessions
  for all to authenticated using (public.is_academy_user()) with check (public.is_academy_user());
create policy "Academy access to attendance" on public.attendance
  for all to authenticated using (public.is_academy_user()) with check (public.is_academy_user());

-- Calendar rules from the supplied 2026 Coco Art schedule.
insert into public.academy_closures (closure_date, name, closure_type) values
  ('2026-06-03', '지방선거', 'holiday'),
  ('2026-07-17', '제헌절', 'holiday'),
  ('2026-07-28', '여름방학', 'vacation'),
  ('2026-07-29', '여름방학', 'vacation'),
  ('2026-07-30', '여름방학', 'vacation'),
  ('2026-07-31', '여름방학', 'vacation'),
  ('2026-08-01', '여름방학', 'vacation'),
  ('2026-08-02', '여름방학', 'vacation'),
  ('2026-08-15', '광복절', 'holiday'),
  ('2026-08-17', '대체공휴일', 'holiday')
on conflict (closure_date) do update set name = excluded.name, closure_type = excluded.closure_type;
