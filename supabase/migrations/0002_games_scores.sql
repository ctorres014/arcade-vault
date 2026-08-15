-- SPEC 06 — Leaderboard real: tabla de juegos y puntuaciones por partida.

-- Tabla mínima de referencia. No sustituye al catálogo de lib/games.ts.
create table public.games (
  id       text primary key,
  title    text not null,
  playable boolean not null default false
);

insert into public.games (id, title, playable) values
  ('bloque-buster', 'BLOQUE BUSTER', false),
  ('caida',         'CAÍDA',         false),
  ('serpentina',    'SERPENTINA',    false),
  ('gloton',        'GLOTÓN',        false),
  ('invasores',     'INVASORES',     false),
  ('asteroides',    'ASTEROIDES',    true),
  ('ranaria',       'RANARIA',       false),
  ('duelo-pixel',   'DUELO PIXEL',   false);

create table public.scores (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  game_id          text not null references public.games(id),
  score            integer not null check (score >= 0),
  level            integer not null check (level >= 1),
  duration_seconds integer not null check (duration_seconds >= 0),
  created_at       timestamptz not null default now()
);

-- El ranking por juego es la consulta caliente de las tres pantallas.
create index scores_game_score_idx on public.scores (game_id, score desc);
create index scores_user_idx       on public.scores (user_id);

alter table public.games  enable row level security;
alter table public.scores enable row level security;

-- Los rankings son públicos por diseño, igual que profiles en el spec 04.
create policy "games_select_public"  on public.games  for select using (true);
create policy "scores_select_public" on public.scores for select using (true);

-- Solo puedes insertar filas a tu nombre, y solo con sesión real.
-- auth.uid() va envuelto en un select por el mismo motivo que en 0001_profiles:
-- así se evalúa una vez por consulta y no una vez por fila.
create policy "scores_insert_own" on public.scores
  for insert with check ((select auth.uid()) = user_id);

-- Sin políticas de update ni delete: las puntuaciones son inmutables.
