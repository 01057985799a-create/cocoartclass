create table if not exists public.artwork_analyses (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  analysis_date date not null default current_date,
  child_age numeric(4,1) not null check (child_age between 2 and 19),
  artwork_title text not null default '',
  teacher_context text not null default '',
  image_path text,
  lowenfeld_stage text not null,
  stage_comparison text not null,
  expressive_tendencies text not null,
  body_form_expression text not null,
  color_pattern_materials text not null,
  composition_space text not null,
  visible_strengths text not null,
  growth_points text not null,
  parent_summary text not null,
  caution_note text not null default '이 분석은 미술교육을 위한 관찰 기록이며, 그림 한 장으로 성격이나 심리 상태를 진단하지 않습니다.',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists artwork_analyses_student_date_idx on public.artwork_analyses(student_id,analysis_date desc);
drop trigger if exists set_artwork_analyses_updated_at on public.artwork_analyses;
create trigger set_artwork_analyses_updated_at before update on public.artwork_analyses for each row execute function public.set_updated_at();
alter table public.artwork_analyses enable row level security;
grant select,insert,update,delete on public.artwork_analyses to authenticated;
revoke all on public.artwork_analyses from anon;
drop policy if exists "Academy access to artwork analyses" on public.artwork_analyses;
create policy "Academy access to artwork analyses" on public.artwork_analyses for all to authenticated using (public.is_academy_user()) with check (public.is_academy_user());

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values ('artwork-images','artwork-images',false,10485760,array['image/jpeg','image/png','image/webp']) on conflict (id) do update set file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "Academy artwork image access" on storage.objects;
create policy "Academy artwork image access" on storage.objects for all to authenticated using (bucket_id='artwork-images' and public.is_academy_user()) with check (bucket_id='artwork-images' and public.is_academy_user());
