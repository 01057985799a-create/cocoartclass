create table if not exists public.academies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.academies(name, code)
values ('코코미술학원', 'COCO')
on conflict(code) do nothing;

alter table public.academy_users
  add column if not exists academy_id uuid references public.academies(id) on delete restrict;

update public.academy_users
set academy_id = (select id from public.academies where code='COCO')
where academy_id is null;

alter table public.academy_users alter column academy_id set not null;
alter table public.academy_users drop constraint if exists academy_users_role_check;
alter table public.academy_users add constraint academy_users_role_check
  check (role in ('super_admin','owner','teacher'));

update public.academy_users
set role='super_admin'
where user_id = (
  select user_id from public.academy_users
  where role='owner' and active=true
  order by created_at limit 1
)
and not exists (select 1 from public.academy_users where role='super_admin' and active=true);

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.academy_users where user_id=auth.uid() and role='super_admin' and active=true);
$$;

create or replace function public.current_academy_id()
returns uuid language sql stable security definer set search_path=public as $$
  select academy_id from public.academy_users where user_id=auth.uid() and active=true limit 1;
$$;

create or replace function public.is_academy_owner()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.academy_users where user_id=auth.uid() and role in ('super_admin','owner') and active=true);
$$;

revoke all on function public.is_super_admin() from public;
revoke all on function public.current_academy_id() from public;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.current_academy_id() to authenticated;

alter table public.academies enable row level security;
drop policy if exists "Members can read academies" on public.academies;
create policy "Members can read academies" on public.academies for select to authenticated
using (public.is_super_admin() or id=public.current_academy_id());

drop policy if exists "Approved academy users can read members" on public.academy_users;
create policy "Academy scoped member access" on public.academy_users for select to authenticated
using (public.is_super_admin() or academy_id=public.current_academy_id());

grant select on public.academies to authenticated;

create or replace function public.handle_new_academy_user()
returns trigger language plpgsql security definer set search_path=public as $$
declare default_academy uuid;
begin
  select id into default_academy from public.academies where code='COCO';
  insert into public.academy_users(user_id,display_name,email,role,active,approval_status,requested_at,academy_id)
  values(new.id,coalesce(new.raw_user_meta_data->>'name',split_part(new.email,'@',1)),new.email,'teacher',false,'pending',now(),default_academy)
  on conflict(user_id) do update set email=excluded.email,display_name=excluded.display_name,requested_at=now();
  return new;
end;
$$;

create or replace function public.owner_review_teacher(target_user_id uuid, decision text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_academy_owner() then raise exception 'owner only'; end if;
  if decision not in ('approved','rejected') then raise exception 'invalid decision'; end if;
  update public.academy_users set approval_status=decision,active=decision='approved',
    approved_at=case when decision='approved' then now() else null end,approved_by=auth.uid()
  where user_id=target_user_id and role='teacher'
    and (public.is_super_admin() or academy_id=public.current_academy_id());
end;
$$;

create or replace function public.owner_set_teacher_active(target_user_id uuid, enabled boolean)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_academy_owner() then raise exception 'owner only'; end if;
  update public.academy_users set active=enabled,
    approval_status=case when enabled then 'approved' else approval_status end
  where user_id=target_user_id and role='teacher'
    and (public.is_super_admin() or academy_id=public.current_academy_id());
end;
$$;
