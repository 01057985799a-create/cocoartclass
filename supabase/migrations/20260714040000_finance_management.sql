-- Simple academy ledger and monthly tuition tracking.

alter table public.class_enrollments
  add column if not exists monthly_fee integer not null default 0
  check (monthly_fee >= 0);

create table if not exists public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_date date not null,
  transaction_type text not null check (transaction_type in ('income', 'expense')),
  category text not null,
  description text not null,
  payment_method text not null default 'card' check (payment_method in ('card', 'cash', 'transfer', 'other')),
  amount integer not null check (amount > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.tuition_payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  billing_month date not null,
  amount integer not null check (amount >= 0),
  paid boolean not null default false,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, billing_month)
);

create index if not exists finance_transactions_date_idx on public.finance_transactions(transaction_date);
create index if not exists tuition_payments_month_idx on public.tuition_payments(billing_month, paid);

drop trigger if exists set_tuition_payments_updated_at on public.tuition_payments;
create trigger set_tuition_payments_updated_at before update on public.tuition_payments
  for each row execute function public.set_updated_at();

alter table public.finance_transactions enable row level security;
alter table public.tuition_payments enable row level security;

grant select, insert, update, delete on public.finance_transactions to authenticated;
grant select, insert, update, delete on public.tuition_payments to authenticated;
revoke all on public.finance_transactions from anon;
revoke all on public.tuition_payments from anon;

create policy "Academy access to finance transactions" on public.finance_transactions
  for all to authenticated using (public.is_academy_user()) with check (public.is_academy_user());
create policy "Academy access to tuition payments" on public.tuition_payments
  for all to authenticated using (public.is_academy_user()) with check (public.is_academy_user());
