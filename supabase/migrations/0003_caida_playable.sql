-- SPEC 07 — Caída pasa a ser jugable: motor portado en lib/games/caida/ y
-- montado en /juegos/caida/jugar.

update public.games set playable = true where id = 'caida';
