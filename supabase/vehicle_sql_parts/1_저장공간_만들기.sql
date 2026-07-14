create table if not exists public.vehicle_routes (
  id uuid primary key default gen_random_uuid(),
  day_of_week smallint not null check (day_of_week between 1 and 6),
  direction text not null check (direction in ('pickup', 'dropoff')),
  class_label text not null default '',
  scheduled_time time not null,
  route_text text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (day_of_week, direction, class_label, scheduled_time, route_text)
);

create table if not exists public.vehicle_route_checks (
  id uuid primary key default gen_random_uuid(),
  vehicle_route_id uuid not null references public.vehicle_routes(id) on delete cascade,
  service_date date not null,
  completed boolean not null default true,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (vehicle_route_id, service_date)
);

create index if not exists vehicle_routes_day_idx on public.vehicle_routes(day_of_week, direction, scheduled_time);
create index if not exists vehicle_route_checks_date_idx on public.vehicle_route_checks(service_date);

alter table public.vehicle_routes enable row level security;
alter table public.vehicle_route_checks enable row level security;

drop policy if exists "academy vehicle routes" on public.vehicle_routes;
create policy "academy vehicle routes" on public.vehicle_routes for all to authenticated using (true) with check (true);
drop policy if exists "academy vehicle checks" on public.vehicle_route_checks;
create policy "academy vehicle checks" on public.vehicle_route_checks for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.vehicle_routes to authenticated;
grant select, insert, update, delete on public.vehicle_route_checks to authenticated;

