-- Store each student's lesson length and pickup/drop-off direction.

alter table public.class_enrollments
  add column if not exists duration_minutes integer not null default 60,
  add column if not exists vehicle_mode text not null default 'none';

alter table public.class_enrollments
  drop constraint if exists class_enrollments_duration_minutes_check,
  add constraint class_enrollments_duration_minutes_check
    check (duration_minutes in (60, 90, 120));

alter table public.class_enrollments
  drop constraint if exists class_enrollments_vehicle_mode_check,
  add constraint class_enrollments_vehicle_mode_check
    check (vehicle_mode in ('none', 'pickup', 'dropoff', 'both'));

-- Existing vehicle users used both directions before this distinction existed.
update public.class_enrollments
set vehicle_mode = 'both'
where uses_vehicle = true and vehicle_mode = 'none';
