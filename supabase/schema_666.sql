-- Общий мир «666»: все игроки заходят в одну комнату с фиксированным кодом 666666.
-- Первый зашедший становится хозяином, остальные подключаются к нему. Выполните в SQL Editor целиком.

-- есть ли сейчас хозяин у мира 666 (строка свежая — обновлялась за последние 150 секунд); видит любой игрок
create or replace function public.get_shared_room()
returns setof public.rooms
language sql
security definer
set search_path = public
as $$
  select * from public.rooms
  where code = '666666' and updated_at >= now() - interval '150 seconds'
  limit 1;
$$;

-- занять мир 666: удаляет устаревшую строку (или строку прежнего хозяина p_prev, который вышел) и создаёт свою.
-- true — вы теперь хозяин; false — мир уже занял кто-то другой (тогда к нему надо подключиться)
create or replace function public.claim_shared_room(p_n text, p_prev uuid default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return false; end if;
  delete from public.rooms
  where code = '666666' and (updated_at < now() - interval '150 seconds' or (p_prev is not null and host = p_prev));
  begin
    insert into public.rooms (code, host, n, owner, w, seed, mode, d, c, pl)
    values ('666666', auth.uid(), left(coalesce(p_n, 'Игрок'), 16), 0, '666', 666, 'survival', 0, 0, 1);
    return true;
  exception when unique_violation then
    return false;
  end;
end $$;

grant execute on function public.get_shared_room() to anon, authenticated;
grant execute on function public.claim_shared_room(text, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
