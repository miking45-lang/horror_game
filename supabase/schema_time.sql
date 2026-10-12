-- Время мира ставит база, а не компьютер хозяина; список миров строит функция на сервере.
-- Выполните в SQL Editor целиком.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.touch_room()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists rooms_touch on public.rooms;
create trigger rooms_touch before insert or update on public.rooms
  for each row execute function public.touch_room();

create or replace function public.list_rooms()
returns setof public.rooms
language sql
security definer
set search_path = public
as $$
  select * from public.rooms
  where updated_at >= now() - interval '120 seconds'
    and encode(extensions.digest(lower(auth.jwt() ->> 'email'), 'sha256'), 'hex') = '2fe36cde0e5a09c7acc928b58b014dcbe94b014cf64526b086b43f967d274136'
  order by updated_at desc;
$$;

grant execute on function public.list_rooms() to authenticated;

-- обновить кэш схемы API, чтобы функция стала видна сразу
notify pgrst, 'reload schema';
