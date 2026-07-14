-- Daily class preparation notes for the Today screen.

create table if not exists public.class_daily_notes (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  lesson_date date not null,
  materials text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, lesson_date)
);

create index if not exists class_daily_notes_date_idx on public.class_daily_notes(lesson_date, class_id);
drop trigger if exists set_class_daily_notes_updated_at on public.class_daily_notes;
create trigger set_class_daily_notes_updated_at before update on public.class_daily_notes
  for each row execute function public.set_updated_at();

alter table public.class_daily_notes enable row level security;
grant select, insert, update, delete on public.class_daily_notes to authenticated;
revoke all on public.class_daily_notes from anon;
create policy "Academy access to daily class notes" on public.class_daily_notes
  for all to authenticated using (public.is_academy_user()) with check (public.is_academy_user());
