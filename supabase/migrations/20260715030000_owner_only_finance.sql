-- Only the academy owner may read or change financial records.
create or replace function public.is_academy_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.academy_users
    where user_id = auth.uid() and role = 'owner' and active = true
  );
$$;

revoke all on function public.is_academy_owner() from public;
grant execute on function public.is_academy_owner() to authenticated;

drop policy if exists "Academy access to finance transactions" on public.finance_transactions;
create policy "Owner access to finance transactions" on public.finance_transactions
  for all to authenticated using (public.is_academy_owner()) with check (public.is_academy_owner());

drop policy if exists "Academy access to tuition payments" on public.tuition_payments;
create policy "Owner access to tuition payments" on public.tuition_payments
  for all to authenticated using (public.is_academy_owner()) with check (public.is_academy_owner());
