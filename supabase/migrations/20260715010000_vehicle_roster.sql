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

insert into public.vehicle_routes (day_of_week,direction,class_label,scheduled_time,route_text,sort_order) values
(1,'pickup','3시 30분 수업','15:20','선일태권도 - 이태윤',1),(1,'dropoff','','16:37','리슈빌포레304동3,4 - 이태윤',2),(1,'pickup','4시 30분 수업','16:20','수자인2정문 - 정하율(승차만)',3),(1,'pickup','5시 30분 수업','16:55','수자인1정문 - 홍이준(솔빛유정,승차만)',4),
(2,'pickup','2시 05분 수업','13:40','훈민초정문 - 김소율(승차만), 지하은',5),(2,'dropoff','','15:14','품태권도 - 오소정',6),(2,'pickup','2시 05분 수업','13:55','고산초후문 - 오소정',7),(2,'dropoff','','15:18','센트레빌정문 - 지하은',8),(2,'dropoff','','16:35','수자인3정문 - 박시아(하차만)',9),(2,'pickup','4시 30분 수업','16:05','훈민초정문 - 이한이(돌봄3반)',10),(2,'dropoff','','17:35','수자인3정문 - 편유솔',11),(2,'pickup','4시 30분 수업','16:15','수자인3정문 - 편유솔',12),(2,'dropoff','','17:40','더샵정문 - 이한이',13),(2,'pickup','4시 30분 수업','16:40','고산초후문 - 소윤나(6월, 승차만)',14),(2,'dropoff','','18:48','수자인3정문 - 양채아(하차만)',15),
(3,'pickup','1시 15분 수업','12:50','고산초후문 - 이설, 원라헌(승차만)',16),(3,'dropoff','','14:25','삼성영어셀레나 - 이설',17),(3,'pickup','2시 수업','13:30','고산초후문 - 신서율(2반)',18),(3,'dropoff','','15:03','센트레빌미용실 - 신서율',19),(3,'pickup','2시 수업','13:30','수자인3정문 - 김채은',20),(3,'dropoff','','15:06','쌍용GS25 - 김승아',21),(3,'pickup','2시 수업','13:40','훈민초정문 - 김승아',22),(3,'dropoff','','15:13','삼성영어셀레나 - 김채은',23),(3,'pickup','3시 30분 수업','15:15','고산초후문 - 김수민 / (6/10~7/8, 9/2~16 승차만)',24),(3,'dropoff','','16:02','수자인2정문 - 김수민(7/15~8/26)',25),(3,'pickup','4시 수업','15:30','정음유치원 - 명하임,김윤우,조예준,김태율 / 강라희(승차만)',26),(3,'dropoff','','17:03','수자인1정문 - 조예준',27),(3,'dropoff','','17:06','센트레빌돌봄센터 - 김태율',28),(3,'pickup','4시 수업','15:40','훈민초정문 - 김민설(돌봄1반)',29),(3,'dropoff','','17:10','대방정문 - 명하임',30),(3,'dropoff','','17:15','한신더휴 - 김윤우',31),(3,'dropoff','','17:20','리슈빌포레B1 - 김민설(303-1,2,3라인)',32),(3,'pickup','5시 수업','16:25','훈민초정문 - 김혜정(돌봄1반)',33),(3,'dropoff','','18:05','수자인3정문 - 박서이,심지유(돌봄센터)',34),(3,'pickup','5시 수업','16:40','고산초병설유치원 -박서이(햇살반,예봄반)',35),(3,'dropoff','','18:10','센트레빌정문 - 이다온(하차만)',36),(3,'pickup','5시 수업','16:45','수자인3정문- 심지유(돌봄센터)',37),(3,'dropoff','','18:13','쌍용GS25 - 김혜정',38),
(4,'pickup','2시 05분 수업','13:40','훈민초정문 - 권주아(승차만)',39),(4,'dropoff','','15:19','품태권도 - 오소정',40),(4,'pickup','2시 05분 수업','13:55','고산초후문 - 오소정',41),(4,'pickup','3시 30분 수업','15:00','훈민초정문 - 최다원',42),(4,'dropoff','','16:36','대방정문 - 최다원(주차장)',43),(4,'pickup','4시 30분 수업','16:05','훈민초정문 - 이한이(돌봄3반)',44),(4,'dropoff','','17:35','수자인3정문 - 박시원',45),(4,'pickup','4시 30분 수업','16:15','수자인3정문 - 박시원',46),(4,'dropoff','','17:39','더샵정문 - 이한이',47),(4,'dropoff','','17:45','대방정문 - 조인성(하차만)',48),
(5,'pickup','1시 15분 수업','12:50','고산초후문 - 이설, 김다예 / 이해야(승차만)',49),(5,'dropoff','','14:20','삼성영어셀레나 - 이설',50),(5,'dropoff','','14:20','고산초후문 - 김다예',51),(5,'pickup','2시 수업','13:30','고산초후문 - 신서율(2반)',52),(5,'dropoff','','15:03','센트레빌미용실 - 신서율',53),(5,'pickup','2시 수업','13:40','훈민초정문 - 김승아, 임서아, 지하은',54),(5,'dropoff','','15:05','센트레빌정문 - 임서아, 지하은',55),(5,'dropoff','','15:07','쌍용GS25 - 김승아',56),(5,'pickup','3시 수업','14:20','고산초후문 - 고다은, 윤예빈(승차만)',57),(5,'dropoff','','15:40','고다은 - 1층(영어)',58),(5,'pickup','3시 수업','14:25','라피니엘정문 - 김륜영(승차만)',59),(5,'dropoff','','17:08','한신더휴 - 김가은(하차만)',60),(5,'pickup','5시 수업','16:30','정음유치원 -서지한(승차만)',61),(5,'dropoff','','18:03','수자인1정문 - 김나윤',62),(5,'pickup','5시 수업','16:35','훈민초정문 - 구본우(돌봄1반)',63),(5,'dropoff','','18:06','라피니엘정문 - 문서이',64),(5,'pickup','5시 수업','16:45','수자인1정문 - 김나윤',65),(5,'dropoff','','19:05','수자인3정문 - 양채아(하차만)',66),(5,'dropoff','','19:10','쌍용GS25 - 구본우',67)
on conflict (day_of_week,direction,class_label,scheduled_time,route_text) do update set sort_order=excluded.sort_order,active=true;
