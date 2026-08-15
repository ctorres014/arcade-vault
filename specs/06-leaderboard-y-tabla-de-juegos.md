# SPEC 06 — Leaderboard real y tabla de juegos

> **Status:** Aprobado
> **Depends on:** 04-supabase-auth, 05-asteroides-jugable
> **Date:** 2026-08-15
> **Objective:** Persistir en Supabase la puntuación de cada partida terminada con las tablas `games` y `scores`, y alimentar con esos datos el Salón de la Fama, la ficha de cada juego y el ranking de la portada, conservando el relleno decorativo actual por debajo de las marcas reales.

## Scope

**In:**

- Migración SQL versionada `supabase/migrations/0002_games_scores.sql`, aplicada al proyecto remoto con `apply_migration` del MCP, con dos tablas:
  - `public.games` mínima (`id`, `title`, `playable`), sembrada con los 8 ids que hoy viven en `lib/games.ts` y `playable = true` solo en `asteroides`. Existe para dar integridad referencial a `scores`, **no** para alimentar el catálogo visual.
  - `public.scores` con `user_id`, `game_id`, `score`, `level`, `duration_seconds` y `created_at`: una fila por partida terminada.
  - RLS en ambas: lectura pública, `insert` en `scores` solo con `auth.uid() = user_id`, y **sin** políticas de `update` ni `delete`. Las puntuaciones son inmutables.
- Tipos a mano en `lib/supabase/types.ts`: `GameRow`, `Score` y `ScoreWithPlayer`.
- Módulo nuevo `lib/scores.ts` con las consultas (top por juego, mejor marca y rango del usuario, ranking global, agregados de la ficha) y la función que fusiona marcas reales con el relleno de `seededScores`.
- Escritura en `app/juegos/[id]/jugar/page.tsx`: al detectar la transición del snapshot a `status: "gameover"`, inserta la fila con el cliente de browser. Solo con sesión real de Supabase; en modo invitado o sin sesión no se guarda nada. `components/games/asteroides.tsx` no se entera de que Supabase existe.
- Medición de `duration_seconds` en la página: marca de tiempo al pasar a `playing` desde `ready`, diferencia al llegar a `gameover`.
- Aviso discreto `NO SE PUDO GUARDAR` en el HUD si el insert falla, sin bloquear el reinicio de la partida.
- Lectura en `/salon-de-la-fama`: sigue siendo Client Component con las pestañas en `useState`, y consulta Supabase al cambiar de juego con su estado de carga. El bloque "TU MEJOR MARCA" pasa a mostrar la puntuación real y el rango calculado, y desaparece si el usuario no tiene partidas en ese juego.
- Lectura en `/juegos/[id]` (Server Component): top 10 real del juego, y las stats `Partidas` y `Mejor global` calculadas desde `scores`, con los valores decorativos de `lib/games.ts` como fallback cuando el juego no tiene ninguna partida.
- Lectura en la home: `TOP_PLAYERS` pasa a ser el top 5 de jugadores por su **mejor puntuación individual** en cualquier juego.
- Regla de fusión, idéntica en las tres pantallas: las marcas reales se ordenan de mayor a menor y encabezan la tabla; `seededScores` rellena por debajo hasta completar el total de siempre (12 en el Salón, 10 en la ficha, 5 en la home). Las filas de relleno se pintan atenuadas y marcadas como `CPU`.
- Estilos nuevos en `app/globals.css`: fila de relleno atenuada con su marca `CPU`, y el aviso de fallo al guardar.

**Out of scope (for future specs):**

- Migrar el catálogo visual a la base de datos: `title`, `short`, `long`, `cat`, `cover` y `color` siguen en `lib/games.ts`, que continúa siendo la fuente de verdad de la UI.
- Cualquier medida anti-trampas: validación en servidor, tokens de partida o límites de puntuación. El insert va directo desde el navegador y el cliente puede mentir.
- Guardar puntuaciones de invitados, y ofrecer login al terminar para conservar la marca.
- Guardar partidas abandonadas: salir con SALIR antes del Game Over descarta la partida.
- Editar o borrar puntuaciones, y página de perfil con historial personal.
- El feed de partidas recientes de la portada, que sigue siendo decorativo.
- Actualización en vivo con Realtime: los rankings se leen al cargar la página.
- Paginación o filtros por fecha en el Salón de la Fama: siempre las 12 primeras.
- Puntuaciones de los otros siete juegos, que no son jugables todavía.
- Tipos generados con `generate_typescript_types`: se siguen escribiendo a mano.
- Tests automatizados: no hay test runner en el repo.

## Data model

Migración `supabase/migrations/0002_games_scores.sql`:

```sql
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
create policy "scores_insert_own" on public.scores
  for insert with check (auth.uid() = user_id);

-- Sin políticas de update ni delete: las puntuaciones son inmutables.
```

Tipos en el cliente (`lib/supabase/types.ts`, junto al `Profile` del spec 04):

```ts
export type GameRow = {
  id: string;
  title: string;
  playable: boolean;
};

export type Score = {
  id: string;
  user_id: string;
  game_id: string;
  score: number;
  level: number;
  duration_seconds: number;
  created_at: string;
};

// Lo que devuelve la consulta de ranking, con el join a profiles.
export type ScoreWithPlayer = Score & { profiles: { username: string } | null };
```

`lib/games.ts` — el `ScoreRow` existente gana un campo, y `seededScores` marca sus filas como relleno:

```ts
export type ScoreRow = {
  rank: number;
  name: string;
  score: number;
  date: string;
  filler: boolean; // true = fila decorativa de seededScores, se pinta atenuada
};
```

`lib/scores.ts` — módulo nuevo, la única puerta a `scores`. Cada consulta recibe el cliente de Supabase como primer parámetro, porque la ficha lo llama desde el servidor y el Salón y la home desde el navegador:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

// Top real de un juego, ya convertido a ScoreRow con filler: false.
export async function fetchGameTop(
  db: SupabaseClient,
  gameId: string,
  limit: number
): Promise<ScoreRow[]>;

// Reales arriba, seededScores debajo hasta completar `total`. Renumera los rangos.
export function mergeWithFiller(real: ScoreRow[], seed: number, total: number): ScoreRow[];

// Mejor marca del usuario en un juego y su posición global. null si no ha jugado.
export async function fetchUserBest(
  db: SupabaseClient,
  userId: string,
  gameId: string
): Promise<{ score: number; date: string; rank: number } | null>;

// Top de jugadores por su mejor puntuación individual en cualquier juego.
export async function fetchGlobalTop(
  db: SupabaseClient,
  limit: number
): Promise<{ username: string; score: number; gameId: string }[]>;

// Agregados de la ficha. plays = 0 y best = null si el juego no tiene partidas.
export async function fetchGameStats(
  db: SupabaseClient,
  gameId: string
): Promise<{ plays: number; best: number | null }>;
```

Convenciones:

- **`user_id` referencia `public.profiles`, no `auth.users`.** El cliente nunca consulta `auth.users`, y todos los rankings necesitan el `username`, que vive en `profiles`. El `on delete cascade` hace que borrar una cuenta se lleve sus puntuaciones.
- `game_id` es `text` y referencia `games.id`, los mismos ids que `lib/games.ts`. La FK es justamente lo que impide que una partida se guarde con un id inventado.
- El nombre del jugador **no** se copia en `scores`: se resuelve con join a `profiles` en cada consulta. Si alguien cambiara su `username`, el ranking entero se actualiza.
- `mergeWithFiller` ordena las reales de mayor a menor y las coloca **siempre por encima** del relleno, sin comparar valores: una marca real de 800 va por delante de una `CPU` de 200.000. Los rangos se renumeran del 1 al total después de fusionar.
- La semilla del relleno se mantiene exactamente como hoy (`id.length * 17 + 3` en la ficha, `tab.length * 23 + 7` en el Salón) para que las filas decorativas no cambien respecto a lo que ya se ve.
- El rango de "TU MEJOR MARCA" se calcula contando los `user_id` **distintos** con una puntuación mayor que la tuya en ese juego, más uno. Con los volúmenes de este proyecto se resuelve en el cliente sobre las filas devueltas; si la tabla creciera, esto pide una vista SQL o una función `rpc`, y queda anotado como riesgo.
- `fetchGlobalTop` pide las mejores puntuaciones ordenadas y se queda con la primera de cada jugador en memoria: no hay `distinct on` desde el cliente de Supabase.
- Fechas: se formatean `dd/mm/aaaa` desde `created_at`, igual que las decorativas.
- El insert se hace con `lib/supabase/client.ts` (browser). No hay Server Action ni Route Handler en este spec.

## Implementation plan

1. Escribir `supabase/migrations/0002_games_scores.sql` con las dos tablas, el seed de los 8 juegos, los índices, RLS y las políticas, y aplicarlo con `apply_migration` del MCP. Test: `list_tables` muestra `public.games` con 8 filas y `public.scores`, ambas con RLS activo, y `get_advisors` no reporta advertencias de seguridad nuevas.
2. Añadir `GameRow`, `Score` y `ScoreWithPlayer` a `lib/supabase/types.ts`. Añadir `filler: boolean` a `ScoreRow` en `lib/games.ts` y hacer que `seededScores` devuelva `filler: true` en todas sus filas. Ajustar los consumidores actuales solo lo necesario para que compile, sin ningún cambio visual. Test: `npm run lint` y `npm run build` pasan y las tres pantallas se ven exactamente como antes.
3. Crear `lib/scores.ts` con `fetchGameTop` y `mergeWithFiller`. Todavía no lo usa nadie. Test: `npm run lint` y `npm run build` pasan.
4. Añadir a `app/globals.css` los estilos de la fila de relleno (atenuada, con la marca `CPU`) y del aviso `NO SE PUDO GUARDAR`. Test: aplicando la clase a mano en el navegador, la fila se distingue de una real sin romper la maquetación de la tabla ni del podio.
5. Implementar la escritura en `app/juegos/[id]/jugar/page.tsx`: detectar en el snapshot la transición `playing → gameover`, medir la duración desde que arrancó la partida, e insertar en `scores` con el cliente de browser solo si `user.kind === "supabase"`. Test manual: jugar una partida completa con sesión iniciada y comprobar con `execute_sql` que existe la fila con el score, el nivel y la duración correctos; repetir como invitado y comprobar que no se inserta nada.
6. Añadir el aviso `NO SE PUDO GUARDAR` en el HUD cuando el insert devuelve error, sin bloquear el reinicio con `Espacio`. Test manual: forzar el fallo cortando la red en las devtools y comprobar que el aviso aparece y el juego sigue siendo jugable.
7. Conectar la ficha `app/juegos/[id]/page.tsx` (Server Component): `fetchGameTop` + `mergeWithFiller` con total 10 para el leaderboard lateral, y `fetchGameStats` para `Partidas` y `Mejor global`, cayendo a `game.plays` y `game.best` cuando el juego no tiene partidas. Test manual: la ficha de Asteroides muestra la marca real en cabeza y relleno `CPU` debajo; la de Caída se ve igual que antes del spec.
8. Conectar `/salon-de-la-fama`: consulta por pestaña en un `useEffect` con estado de carga, fusión con total 12, y el podio leyendo de las filas ya fusionadas. Test manual: cambiar de pestaña carga los datos del juego correspondiente sin dejar la tabla en un estado intermedio incoherente.
9. Sustituir el bloque "TU MEJOR MARCA" por datos reales con `fetchUserBest`: puntuación, fecha y rango calculado, y ocultarlo cuando el usuario no tiene partidas en ese juego. Eliminar `youRank` y `youScore`. Test manual: con dos cuentas y varias partidas, los rangos coinciden con el orden de la tabla.
10. Conectar el ranking de la home con `fetchGlobalTop` y fusión hasta 5 filas, eliminando el array `TOP_PLAYERS`. El feed de partidas recientes no se toca. Test manual: el jugador con la mejor marca real encabeza el bloque y el resto es relleno atenuado.
11. Verificación final: `npm run lint`, `npm run build` y `get_advisors` sin advertencias nuevas. Repasar que ninguna de las tres pantallas llama a `seededScores` fuera de `mergeWithFiller`.

## Acceptance criteria

- [ ] `npm run build` y `npm run lint` pasan sin errores.
- [ ] `supabase/migrations/0002_games_scores.sql` está commiteado y `list_tables` muestra `public.games` y `public.scores` con RLS habilitado.
- [ ] `public.games` contiene exactamente 8 filas, con los mismos ids que `lib/games.ts` y `playable = true` únicamente en `asteroides`.
- [ ] `get_advisors` no reporta advertencias de seguridad nuevas sobre `games` ni `scores`.
- [ ] Insertar en `scores` un `game_id` que no existe en `games` falla por la foreign key.
- [ ] Con sesión real, terminar una partida de Asteroides crea exactamente una fila en `scores` con el `score` final, el `level` alcanzado, la duración en segundos y el `user_id` de la sesión.
- [ ] Jugar como invitado o sin sesión no crea ninguna fila, y la partida se juega hasta el final sin errores en consola.
- [ ] Salir con SALIR o VOLVER AL VAULT antes del Game Over no crea ninguna fila.
- [ ] Reiniciar con `Espacio` tras el Game Over y volver a morir crea una segunda fila independiente.
- [ ] Un intento de `insert` en `scores` con un `user_id` distinto al de la sesión es rechazado por RLS.
- [ ] Un intento de `update` o `delete` sobre una fila propia de `scores` no modifica nada.
- [ ] Si el insert falla, aparece el aviso `NO SE PUDO GUARDAR` en el HUD y el juego se puede reiniciar igualmente con `Espacio`.
- [ ] En `/juegos/asteroides`, las puntuaciones reales aparecen por encima de las de relleno, con los rangos numerados del 01 al 10 sin saltos.
- [ ] Las filas de relleno se distinguen visualmente de las reales (atenuadas y marcadas como `CPU`) en la ficha, en el Salón de la Fama y en la home.
- [ ] En `/juegos/asteroides`, `Partidas` y `Mejor global` reflejan los valores reales de `scores`; en `/juegos/caida`, que no tiene partidas, siguen mostrando los valores decorativos de `lib/games.ts`.
- [ ] `/salon-de-la-fama` muestra las 12 filas de siempre en todas las pestañas, con el podio completo, y ninguna pestaña queda vacía ni rota.
- [ ] Cambiar de pestaña en el Salón muestra un estado de carga y termina mostrando los datos del juego seleccionado, no los del anterior.
- [ ] Con sesión y al menos una partida en el juego seleccionado, "TU MEJOR MARCA" muestra la mejor puntuación real, su fecha y un rango coherente con el orden de la tabla.
- [ ] Sin sesión, o con sesión pero sin partidas en ese juego, el bloque "TU MEJOR MARCA" no aparece.
- [ ] El ranking de la portada muestra a los jugadores reales por su mejor puntuación individual, sin repetir el mismo jugador dos veces, y completa hasta 5 con relleno.
- [ ] Cambiar el `username` de un perfil en la base de datos cambia el nombre mostrado en los tres rankings sin tocar `scores`.
- [ ] `TOP_PLAYERS` ya no existe en `app/page.tsx`, y `youRank` y `youScore` ya no existen en `app/salon-de-la-fama/page.tsx`.
- [ ] `seededScores` solo se invoca desde `mergeWithFiller`.
- [ ] Ninguna página consume `game.best` ni `game.plays` salvo como fallback de un juego sin partidas.

## Decisiones

- **Sí:** un solo spec para las dos tablas. Decisión del usuario, contra mi recomendación de repartirlo en dos. `scores` necesita la FK a `games`, así que las dos migraciones habrían llegado juntas de todos modos; el coste es un spec largo, de once pasos y cuatro pantallas tocadas.
- **Sí:** `games` mínima (`id`, `title`, `playable`), solo como tabla de referencia. Decisión del usuario. La FK gana integridad sin obligar a un refactor del catálogo entero.
- **No:** migrar `title`, `short`, `long`, `cat`, `cover` y `color` a la base de datos. Sería la fuente de verdad única, pero convierte cuatro páginas en consumidoras de Supabase y `cover` es una clase CSS, no un dato: se pagaría un refactor grande a cambio de nada visible.
- **Sí:** sembrar los 8 juegos aunque solo uno sea jugable. Los siete restantes ya tienen id estable en `lib/games.ts`, y así el spec de cada juego futuro no tiene que tocar la base de datos.
- **Sí:** columna `playable`. Documenta en la base de datos lo que hoy es un `game.id === "asteroides"` incrustado en el código de la página.
- **Sí:** guardar solo con sesión real de Supabase. Decisión del usuario. RLS queda en una sola línea (`auth.uid() = user_id`) y no hay que decidir qué hacer con nombres de invitado repetidos.
- **No:** invitados guardando con alias. Obligaría a permitir `insert` anónimo, y entonces cualquiera puede llenar la tabla con un `curl`.
- **No:** ofrecer login al terminar la partida para conservar la marca. Es buena experiencia, pero exige guardar la puntuación en algún sitio durante el redirect a `/auth` y recuperarla al volver.
- **Sí:** una fila por partida terminada. Decisión del usuario. Conserva el histórico, permite que `Partidas` sea un número real y deja la puerta abierta a estadísticas sin migrar nada.
- **No:** una fila por jugador y juego con upsert. La tabla sería más pequeña, pero el histórico se pierde y no hay forma de recuperarlo.
- **Sí:** insert directo desde el navegador con RLS. Decisión del usuario. **Asumido explícitamente: cualquiera con la consola abierta puede insertar la puntuación que quiera.** Los rankings de este proyecto no son competitivos de verdad y una capa de servidor no lo impediría del todo.
- **No:** Server Action con validaciones, ni Route Handler con token de partida. Suben el listón contra las trampas, pero son un spec entero y no cierran el agujero.
- **Sí:** guardar solo en Game Over. Decisión del usuario. Un `useEffect` de limpieza que escriba al desmontar es frágil en Strict Mode y puede duplicar filas.
- **Sí:** `level` y `duration_seconds` en la tabla. Decisión del usuario. El nivel sale gratis del snapshot; la duración no la consume nadie todavía, pero añadirla después de tener datos es más caro que ahora.
- **Sí:** ambas columnas `not null`. Asteroides tiene las dos y es el único que escribe. Contrapartida asumida: un juego futuro sin niveles tendrá que insertar `1`.
- **Sí:** conservar `seededScores` como relleno por debajo de las marcas reales. Decisión del usuario. Las tablas se ven llenas desde el primer día, incluso en los siete juegos que no son jugables.
- **Sí:** relleno atenuado y marcado como `CPU`. Decisión del usuario. Es lo que hace que mezclar datos reales e inventados no sea directamente engañoso, y lo que permite verificarlo en un criterio de aceptación.
- **No:** mezclar reales y relleno ordenando por puntuación. Sería más coherente visualmente, pero hundiría las primeras marcas reales al fondo de la tabla, que es justo lo contrario de lo que se busca.
- **No:** estado vacío honesto ("aún no hay puntuaciones"). Era mi recomendación y el usuario eligió el relleno: la app conserva el aspecto de arcade lleno a cambio de seguir mostrando nombres inventados.
- **Sí:** las tres pantallas leen datos reales. Decisión del usuario. Dejar alguna con datos falsos habría dejado la incoherencia de ver un récord en la ficha que no aparece en el Salón.
- **No:** récord personal en el HUD mientras se juega. Es una consulta y un `hud-stat` más, y el HUD del spec 05 ya está cerrado.
- **Sí:** `/salon-de-la-fama` sigue siendo Client Component y consulta por pestaña. Decisión del usuario. Evita el refactor a Server Component, a cambio de un parpadeo de carga al cambiar de juego.
- **No:** cargar los 8 juegos de una vez. Suprime el parpadeo, pero trae datos que casi nadie mira.
- **Sí:** el insert vive en `app/juegos/[id]/jugar/page.tsx`. Decisión del usuario. La página ya recibe el snapshot y ya conoce al usuario, y `components/games/asteroides.tsx` sigue siendo un componente de juego puro que los próximos juegos pueden copiar.
- **No:** que el componente del juego guarde su propia puntuación. Acopla cada juego a Supabase y habría que repetirlo en Tetris y Arkanoid.
- **Sí:** aviso visible cuando falla el guardado. Decisión del usuario. Callar el error haría creer al jugador que su récord quedó registrado.
- **Sí:** puntuaciones inmutables, sin políticas de `update` ni `delete`. Decisión del usuario. Nadie puede maquillar su historial ni borrar una mala partida desde la consola.
- **Sí:** `user_id` referencia `profiles` y el nombre se resuelve por join. Cambiar el `username` actualiza los rankings solos, y no hay nombres duplicados desincronizados.
- **No:** copiar el `username` dentro de `scores`. Ahorraría el join, pero congelaría el nombre en el momento de la partida.
- **Sí:** tipos escritos a mano. Coherente con el spec 04; dos tablas pequeñas no justifican añadir un paso de generación al flujo.

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| El insert va directo desde el navegador: cualquiera puede guardar la puntuación que quiera con dos líneas en la consola. | Aceptado y declarado de forma explícita en el scope y en las decisiones. RLS garantiza al menos que nadie puede escribir a nombre de otro. Las validaciones de servidor quedan para un spec futuro. |
| Mezclar marcas reales con relleno `CPU` en la misma tabla puede leerse como que la plataforma inventa datos. | Las filas de relleno van atenuadas y marcadas como `CPU`, con criterio de aceptación específico en las tres pantallas. |
| `Partidas` pasa de "15.6K" a un número de una cifra en cuanto haya una partida real, porque el fallback solo aplica con cero filas. | Es el comportamiento pedido y está en el criterio de aceptación. Conviene no sorprenderse al ver la ficha después de la primera partida. |
| El rango de "TU MEJOR MARCA" se calcula contando jugadores distintos en el cliente: con muchas filas, la consulta crece y el cálculo deja de ser barato. | Volumen irrelevante en este proyecto. Si crece, se sustituye por una vista SQL o una función `rpc` sin tocar la UI, porque todo pasa por `lib/scores.ts`. |
| La transición a `gameover` podría dispararse más de una vez y duplicar la fila (re-render, Strict Mode, snapshot repetido). | El motor solo emite cuando el snapshot cambia, y la página guarda una marca de "ya guardado" para esta partida que se limpia al reiniciar. Hay criterio de aceptación de una sola fila por partida y de dos filas tras reiniciar. |
| `lib/scores.ts` se llama desde un Server Component (la ficha) y desde Client Components (Salón y home): importar el cliente equivocado rompe el render o filtra cookies. | Ninguna función crea su propio cliente: todas reciben el `SupabaseClient` como primer parámetro, y cada página pasa el suyo. |
| El seed de `games` y los ids de `lib/games.ts` pueden divergir si alguien renombra un juego, como pasó con `rocas` → `asteroides` en el spec 05. | La FK falla de forma ruidosa al guardar, y un criterio de aceptación exige que las 8 filas coincidan con los ids del catálogo. Cualquier renombrado futuro tendrá que incluir su migración. |
| El invitado juega una partida entera y descubre al morir que no se guardó nada. | El aviso del HUD cubre el fallo técnico; para el invitado, avisar antes de jugar queda fuera de este spec y sería una mejora de UX en el spec que trate el modo invitado. |

## What is **not** in this spec

- Migrar el catálogo visual de juegos a la base de datos.
- Medidas anti-trampas: validación en servidor, tokens de partida o límites de puntuación.
- Puntuaciones de invitados y login al terminar la partida para conservarlas.
- Guardar partidas abandonadas.
- Editar o borrar puntuaciones, y página de perfil con historial.
- El feed de partidas recientes de la portada.
- Actualización en vivo con Realtime.
- Paginación y filtros por fecha en el Salón de la Fama.
- Los otros siete juegos del catálogo.
- Tipos TypeScript generados de la base de datos.
- Tests automatizados.

Cada uno de estos, si se implementa, va en su propio spec.
