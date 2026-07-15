create or replace function public.is_academy_user()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1
    from public.academy_users au
    join public.academies a on a.id=au.academy_id
    where au.user_id=auth.uid()
      and au.active=true
      and (au.role='super_admin' or a.active=true)
  );
$$;

create or replace function public.is_academy_owner()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1
    from public.academy_users au
    join public.academies a on a.id=au.academy_id
    where au.user_id=auth.uid()
      and au.active=true
      and (au.role='super_admin' or (au.role='owner' and a.active=true))
  );
$$;

create or replace function public.super_admin_set_academy_active(target_academy_id uuid, enabled boolean)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_super_admin() then raise exception 'super admin only'; end if;
  if target_academy_id=public.current_academy_id() and enabled=false then
    raise exception 'cannot suspend the super admin academy';
  end if;
  update public.academies set active=enabled where id=target_academy_id;
end;
$$;

revoke all on function public.super_admin_set_academy_active(uuid,boolean) from public;
grant execute on function public.super_admin_set_academy_active(uuid,boolean) to authenticated;
