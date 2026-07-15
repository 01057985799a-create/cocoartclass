alter table public.academy_users
  add column if not exists email text,
  add column if not exists approval_status text not null default 'approved'
    check (approval_status in ('pending','approved','rejected')),
  add column if not exists requested_at timestamptz not null default now(),
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references auth.users(id) on delete set null;

update public.academy_users au
set email = u.email,
    approval_status = case when au.active then 'approved' else au.approval_status end,
    approved_at = case when au.active then coalesce(au.approved_at, au.created_at) else au.approved_at end
from auth.users u
where u.id = au.user_id and au.email is null;

create or replace function public.handle_new_academy_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.academy_users(user_id, display_name, email, role, active, approval_status, requested_at)
  values(new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), new.email, 'teacher', false, 'pending', now())
  on conflict(user_id) do update set
    email = excluded.email,
    display_name = excluded.display_name,
    requested_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_academy_request on auth.users;
create trigger on_auth_user_created_academy_request
  after insert on auth.users
  for each row execute function public.handle_new_academy_user();

create or replace function public.owner_review_teacher(target_user_id uuid, decision text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_academy_owner() then raise exception 'owner only'; end if;
  if decision not in ('approved','rejected') then raise exception 'invalid decision'; end if;
  update public.academy_users set
    approval_status = decision,
    active = decision = 'approved',
    approved_at = case when decision='approved' then now() else null end,
    approved_by = auth.uid()
  where user_id = target_user_id and role = 'teacher';
end;
$$;

create or replace function public.owner_set_teacher_active(target_user_id uuid, enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_academy_owner() then raise exception 'owner only'; end if;
  update public.academy_users set active=enabled,
    approval_status=case when enabled then 'approved' else approval_status end
  where user_id=target_user_id and role='teacher';
end;
$$;

revoke all on function public.owner_review_teacher(uuid,text) from public;
revoke all on function public.owner_set_teacher_active(uuid,boolean) from public;
grant execute on function public.owner_review_teacher(uuid,text) to authenticated;
grant execute on function public.owner_set_teacher_active(uuid,boolean) to authenticated;

drop policy if exists "Academy users can read members" on public.academy_users;
create policy "Approved academy users can read members" on public.academy_users
  for select to authenticated using (public.is_academy_user());

grant select on public.academy_users to authenticated;
