-- AI-assisted student feedback history.

create table if not exists public.student_feedback (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  feedback_date date not null,
  lesson_topic text not null,
  observation_notes text not null,
  class_summary text not null,
  strengths text not null,
  next_focus text not null,
  parent_message text not null,
  status text not null default 'draft' check (status in ('draft', 'shared')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists student_feedback_student_date_idx
  on public.student_feedback(student_id, feedback_date desc);

drop trigger if exists set_student_feedback_updated_at on public.student_feedback;
create trigger set_student_feedback_updated_at before update on public.student_feedback
  for each row execute function public.set_updated_at();

alter table public.student_feedback enable row level security;
grant select, insert, update, delete on public.student_feedback to authenticated;
revoke all on public.student_feedback from anon;

create policy "Academy access to student feedback" on public.student_feedback
  for all to authenticated using (public.is_academy_user()) with check (public.is_academy_user());
