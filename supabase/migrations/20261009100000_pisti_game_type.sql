-- Blöflü Pişti: tag tables so 101 and Pişti share seats/realtime but not rules.

alter table public.game_tables
  add column game_type text not null default 'okey101';

alter table public.game_tables
  add constraint game_tables_game_type_check
  check (game_type in ('okey101', 'pisti'));
