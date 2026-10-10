-- ============================================================
--  Туманный Край: таблица открытых миров для сетевой игры.
--  Выполните целиком в Supabase: SQL Editor → New query → Run.
--  Перед запуском замените Ertyunjoki@hotmail.com на почту владельца игры.
-- ============================================================

create table if not exists public.rooms (
  code        text primary key,
  host        uuid not null,                 -- auth.uid() хозяина мира
  n           text,                          -- ник хозяина
  owner       int  not null default 0,       -- 1, если хозяин — владелец игры
  w           text,                          -- название мира
  seed        bigint,
  mode        text,
  d           double precision default 0,    -- время суток
  c           int default 0,                 -- номер дня
  pl          int default 1,                 -- сколько игроков в мире (включая хозяина)
  updated_at  timestamptz not null default now()
);

alter table public.rooms enable row level security;

-- хозяин мира управляет только своей строкой
create policy "host insert" on public.rooms for insert
  with check (host = auth.uid());
create policy "host update" on public.rooms for update
  using (host = auth.uid()) with check (host = auth.uid());
create policy "host delete" on public.rooms for delete
  using (host = auth.uid());

-- список миров видит только владелец игры (по почте в токене входа)
create policy "owner list" on public.rooms for select
  using (lower(auth.jwt() ->> 'email') = lower('Ertyunjoki@hotmail.com'));

-- вход по коду: только владелец игры может получить строку мира по коду
create or replace function public.get_room(p_code text)
returns setof public.rooms
language sql
security definer
set search_path = public
as $$
  select * from public.rooms
  where code = upper(p_code)
    and lower(auth.jwt() ->> 'email') = lower('Ertyunjoki@hotmail.com')
  limit 1;
$$;

grant execute on function public.get_room(text) to anon, authenticated;
