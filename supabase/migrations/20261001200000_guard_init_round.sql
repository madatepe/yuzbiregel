-- Make round initialisation idempotent: only one caller may move the table
-- from the expected status into 'playing'.

drop function if exists public.init_round(uuid, int, int, jsonb, jsonb, jsonb, jsonb);

create or replace function public.init_round(
  p_table uuid,
  p_game_no int,
  p_round int,
  p_secret jsonb,
  p_public jsonb,
  p_events jsonb,
  p_hands jsonb, -- [{seat, player_id, tiles}]
  p_from_status text
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v int;
begin
  update game_tables
  set status = 'playing', game_no = p_game_no, current_round = p_round, updated_at = now()
  where id = p_table and status = p_from_status;

  if not found then
    raise exception 'BAD_STATE';
  end if;

  insert into game_secret (table_id, state, version)
  values (p_table, p_secret, 1)
  on conflict (table_id) do update set state = excluded.state, version = game_secret.version + 1
  returning version into v;

  insert into game_public (table_id, game_no, round, state, last_events, version, updated_at)
  values (p_table, p_game_no, p_round, p_public, p_events, v, now())
  on conflict (table_id) do update set
    game_no = excluded.game_no, round = excluded.round, state = excluded.state,
    last_events = excluded.last_events, version = excluded.version, updated_at = now();

  insert into game_hands (table_id, seat, player_id, tiles, round, version)
  select p_table, x.seat, x.player_id, x.tiles, p_round, v
  from jsonb_to_recordset(p_hands) as x(seat smallint, player_id uuid, tiles jsonb)
  on conflict (table_id, seat) do update set
    player_id = excluded.player_id, tiles = excluded.tiles, round = excluded.round, version = excluded.version;

  return v;
end;
$$;

revoke all on function public.init_round(uuid, int, int, jsonb, jsonb, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.init_round(uuid, int, int, jsonb, jsonb, jsonb, jsonb, text) to service_role;
