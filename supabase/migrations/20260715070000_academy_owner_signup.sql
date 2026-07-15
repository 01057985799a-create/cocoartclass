create or replace function public.handle_new_academy_user()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  target_academy uuid;
  generated_code text;
  account_type text;
begin
  account_type := coalesce(new.raw_user_meta_data->>'account_type','teacher');

  if account_type='academy_owner' then
    generated_code := 'ACADEMY-' || upper(substr(replace(new.id::text,'-',''),1,8));
    insert into public.academies(name,code,active,director_name,business_number)
    values(
      coalesce(nullif(new.raw_user_meta_data->>'academy_name',''),'새 미술학원'),
      generated_code,
      true,
      coalesce(nullif(new.raw_user_meta_data->>'name',''),split_part(new.email,'@',1)),
      nullif(new.raw_user_meta_data->>'business_number','')
    ) returning id into target_academy;

    insert into public.academy_users(user_id,display_name,email,role,active,approval_status,requested_at,approved_at,academy_id)
    values(new.id,coalesce(nullif(new.raw_user_meta_data->>'name',''),split_part(new.email,'@',1)),new.email,'owner',true,'approved',now(),now(),target_academy)
    on conflict(user_id) do update set academy_id=excluded.academy_id,display_name=excluded.display_name,email=excluded.email,role='owner',active=true,approval_status='approved';
  else
    select id into target_academy
    from public.academies
    where upper(code)=upper(coalesce(new.raw_user_meta_data->>'academy_code','COCO')) and active=true
    limit 1;

    if target_academy is null then raise exception 'invalid academy code'; end if;

    insert into public.academy_users(user_id,display_name,email,role,active,approval_status,requested_at,academy_id)
    values(new.id,coalesce(nullif(new.raw_user_meta_data->>'name',''),split_part(new.email,'@',1)),new.email,'teacher',false,'pending',now(),target_academy)
    on conflict(user_id) do update set academy_id=excluded.academy_id,email=excluded.email,display_name=excluded.display_name,requested_at=now();
  end if;
  return new;
end;
$$;
