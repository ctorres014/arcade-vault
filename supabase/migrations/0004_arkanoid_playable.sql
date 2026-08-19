-- SPEC 08 — Arkanoid: el catálogo renombra `bloque-buster` a `arkanoid` y el
-- juego pasa a ser jugable con el motor de lib/games/arkanoid/.

-- El renombrado del id es seguro: la fila no tenía ninguna puntuación en
-- `scores`, así que la FK `scores.game_id -> games.id` no arrastra nada.
update public.games
   set id       = 'arkanoid',
       title    = 'ARKANOID',
       playable = true
 where id = 'bloque-buster';
