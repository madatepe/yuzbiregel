-- 101 Okey: core schema. All writes go through Edge Functions (service role);
-- clients only read, and only what RLS allows.

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  nickname text not null check (char_length(nickname) between 2 and 16),
  updated_at timestamptz not null default now()
);

create table public.game_tables (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  owner_id uuid not null references auth.users on delete cascade,
  mode text not null check (mode in ('solo', 'team')),
  total_rounds int not null check (total_rounds in (1, 6, 11)),
  status text not null default 'waiting'
    check (status in ('waiting', 'playing', 'round_end', 'finished', 'closed')),
  game_no int not null default 1,
  current_round int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.table_seats (
  table_id uuid not null references public.game_tables on delete cascade,
  seat smallint not null check (seat between 0 and 3),
  player_id uuid not null references auth.users on delete cascade,
  nickname text not null,
  left_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (table_id, seat),
  unique (table_id, player_id)
);

create table public.game_public (
  table_id uuid primary key references public.game_tables on delete cascade,
  game_no int not null,
  round int not null,
  state jsonb not null,
  last_events jsonb not null default '[]'::jsonb,
  version int not null default 0,
  updated_at timestamptz not null default now()
);

create table public.game_hands (
  table_id uuid not null references public.game_tables on delete cascade,
  seat smallint not null check (seat between 0 and 3),
  player_id uuid not null references auth.users on delete cascade,
  tiles jsonb not null default '[]'::jsonb,
  round int not null default 0,
  version int not null default 0,
  primary key (table_id, seat)
);

create table public.game_secret (
  table_id uuid primary key references public.game_tables on delete cascade,
  state jsonb not null,
  version int not null default 0
);

create table public.round_scores (
  table_id uuid not null references public.game_tables on delete cascade,
  game_no int not null,
  round int not null,
  seat smallint not null check (seat between 0 and 3),
  nickname text not null,
  score int not null,
  hand_score int not null,
  penalty int not null,
  created_at timestamptz not null default now(),
  primary key (table_id, game_no, round, seat)
);

create index table_seats_player_idx on public.table_seats (player_id);
create index round_scores_table_idx on public.round_scores (table_id, game_no);

-- RLS -----------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.game_tables enable row level security;
alter table public.table_seats enable row level security;
alter table public.game_public enable row level security;
alter table public.game_hands enable row level security;
alter table public.game_secret enable row level security;
alter table public.round_scores enable row level security;

create policy "profiles readable" on public.profiles for select to authenticated using (true);
create policy "profiles own insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "profiles own update" on public.profiles for update to authenticated using (id = auth.uid());

create policy "tables readable" on public.game_tables for select to authenticated using (true);
create policy "seats readable" on public.table_seats for select to authenticated using (true);
create policy "public state readable" on public.game_public for select to authenticated using (true);
create policy "own hand readable" on public.game_hands for select to authenticated using (player_id = auth.uid());
create policy "scores readable" on public.round_scores for select to authenticated using (true);
-- game_secret: no policies, service role only.

-- Realtime ------------------------------------------------------------------
alter publication supabase_realtime add table
  public.game_tables, public.table_seats, public.game_public, public.game_hands, public.round_scores;

-- Atomic state writes (service role only) -------------------------------------

-- Starts a round: replaces secret/public state and deals hands.
create or replace function public.init_round(
  p_table uuid,
  p_game_no int,
  p_round int,
  p_secret jsonb,
  p_public jsonb,
  p_events jsonb,
  p_hands jsonb -- [{seat, player_id, tiles}]
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v int;
begin
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

  update game_tables
  set status = 'playing', game_no = p_game_no, current_round = p_round, updated_at = now()
  where id = p_table;

  return v;
end;
$$;

-- Applies one move with optimistic locking.
create or replace function public.commit_move(
  p_table uuid,
  p_expected int,
  p_secret jsonb,
  p_public jsonb,
  p_events jsonb,
  p_hands jsonb,          -- [{seat, tiles}] only changed hands
  p_table_status text,    -- null to keep
  p_scores jsonb          -- null or [{seat, nickname, score, hand_score, penalty}]
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v int;
  t record;
begin
  update game_secret set state = p_secret, version = version + 1
  where table_id = p_table and version = p_expected
  returning version into v;

  if v is null then
    raise exception 'VERSION_CONFLICT';
  end if;

  update game_public
  set state = p_public, last_events = p_events, version = v, updated_at = now()
  where table_id = p_table;

  update game_hands h
  set tiles = x.tiles, version = v
  from jsonb_to_recordset(p_hands) as x(seat smallint, tiles jsonb)
  where h.table_id = p_table and h.seat = x.seat;

  if p_scores is not null then
    select game_no, current_round into t from game_tables where id = p_table;
    insert into round_scores (table_id, game_no, round, seat, nickname, score, hand_score, penalty)
    select p_table, t.game_no, t.current_round, x.seat, x.nickname, x.score, x.hand_score, x.penalty
    from jsonb_to_recordset(p_scores) as x(seat smallint, nickname text, score int, hand_score int, penalty int)
    on conflict do nothing;
  end if;

  if p_table_status is not null then
    update game_tables set status = p_table_status, updated_at = now() where id = p_table;
  end if;

  return v;
end;
$$;

revoke all on function public.init_round(uuid, int, int, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.commit_move(uuid, int, jsonb, jsonb, jsonb, jsonb, text, jsonb) from public, anon, authenticated;
grant execute on function public.init_round(uuid, int, int, jsonb, jsonb, jsonb, jsonb) to service_role;
grant execute on function public.commit_move(uuid, int, jsonb, jsonb, jsonb, jsonb, text, jsonb) to service_role;
