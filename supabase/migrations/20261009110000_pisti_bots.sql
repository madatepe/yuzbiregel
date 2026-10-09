-- Solo Pişti: bot seats have no auth user.

alter table public.table_seats
  add column is_bot boolean not null default false;

alter table public.table_seats
  alter column player_id drop not null;

alter table public.game_hands
  alter column player_id drop not null;
