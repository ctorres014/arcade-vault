# Integración con la plataforma

## 1. Catálogo visual — `lib/games.ts`

Fuente de verdad de la UI (título, textos, categoría, portada, color). **No está
en la base de datos y no se migra.** Entrada:

```ts
{
  id: "tetris",          // kebab-case, es el id de la URL y la FK de scores
  title: "CAÍDA",
  short: "...",          // una línea, para la tarjeta
  long: "...",           // párrafo de la ficha: describe el juego REAL
  cat: "PUZZLE",         // ARCADE | PUZZLE | SHOOTER | VERSUS
  cover: "cover-tetro",  // clase CSS de app/globals.css
  color: "magenta",      // cyan | magenta | yellow | green
  best: 184220,          // decorativos: solo se usan como fallback en la ficha
  plays: "31.8K",        //   cuando el juego aún no tiene ninguna partida real
}
```

Si el juego es nuevo, la portada `cover-*` hay que crearla en `app/globals.css`
(base + `::before` + `::after`, mira `.cover-asteroides` en la línea ~472).

## 2. Tabla de referencia — `public.games`

Los 8 ids del catálogo ya están sembrados por
`supabase/migrations/0002_games_scores.sql`. Un id que no esté ahí **no puede
guardar puntuaciones**: `scores.game_id` tiene FK a `games.id` y el insert falla
de forma ruidosa.

Migración nueva (numera correlativo, aplícala con `apply_migration` del MCP y
commitea el archivo):

```sql
-- Juego nuevo en el catálogo
insert into public.games (id, title, playable) values ('mi-juego', 'MI JUEGO', true);

-- O, si ya existía como no jugable
update public.games set playable = true where id = 'tetris';
```

Comprueba después con `list_tables` y `get_advisors` (sin advertencias nuevas).

## 3. Guardado de la partida

Ya implementado y **genérico** en `app/juegos/[id]/jugar/page.tsx`. Cómo funciona,
para no romperlo:

- Todo el guardado vive en **refs**, porque se lee desde el callback del motor,
  fuera del ciclo de render: `statusRef` (estado anterior), `startedAtRef`,
  `savedRef` y `userRef`.
- Al entrar en `playing` desde `ready` o `gameover`: se marca `startedAtRef`, se
  limpia `savedRef` y se borra el aviso de la partida anterior.
- Al entrar en `gameover`: si el jugador es `user.kind === "supabase"`, se inserta
  una fila. `savedRef` se marca **antes del await**, para que un segundo
  `gameover` no cree una fila duplicada.
- Invitado o sin sesión: se juega igual, no se guarda nada, sin errores en
  consola.
- Si el insert falla: `NO SE PUDO GUARDAR` en el HUD (`.hud-warn`), y la partida
  se reinicia con Espacio igualmente. Nunca se bloquea el juego por esto.
- Salir con SALIR / VOLVER AL VAULT antes del Game Over descarta la partida.

Las puntuaciones son **inmutables**: `scores` no tiene políticas de `update` ni
`delete`. Y el insert va directo desde el navegador: está asumido y declarado en
el spec 06 que un usuario con la consola abierta puede mentir.

## 4. Lecturas — `lib/scores.ts`

Es la única puerta a `scores`. Ninguna función crea su cliente: todas reciben el
`SupabaseClient` como primer parámetro, porque la ficha consulta desde el
servidor (`lib/supabase/server.ts`) y el Salón y la home desde el navegador
(`lib/supabase/client.ts`).

| Función | Dónde se usa |
| --- | --- |
| `fetchGameTop(db, gameId, limit)` | ficha (10) y Salón (12) |
| `fetchUserBest(db, userId, gameId)` | Salón, bloque "TU MEJOR MARCA" |
| `fetchGlobalTop(db, limit)` | ranking de la portada (5) |
| `fetchGameStats(db, gameId)` | ficha: `Partidas` y `Mejor global` |
| `mergeWithFiller(real, seed, total)` | las tres pantallas |

Un juego nuevo **no requiere tocar este módulo**: todas las consultas filtran por
`game_id` y empiezan a devolver datos en cuanto hay filas.

## 5. Regla de fusión con el relleno

`seededScores` solo se invoca desde `mergeWithFiller`. Nunca lo llames directo
desde una pantalla.

- Las marcas reales se ordenan de mayor a menor y van **siempre por encima** del
  relleno, sin comparar valores: una real de 800 va por delante de una `CPU` de
  200.000. Los rangos se renumeran del 1 al total tras fusionar.
- Filas de relleno: `filler: true`, clase `is-filler`, atenuadas y marcadas como
  `CPU`. Es lo que evita que mezclar datos reales e inventados sea engañoso.
- Semillas, que **no deben cambiar** para que el relleno se vea igual que
  siempre: ficha `id.length * 17 + 3` (total 10), Salón `tab.length * 23 + 7`
  (total 12), home su constante propia (total 5).
- Fallback de la ficha: `game.best` y `game.plays` de `lib/games.ts` **solo**
  cuando el juego tiene cero partidas. En cuanto haya una, `Partidas` pasa de
  "15.6K" a `1`. Es el comportamiento pedido, no un bug.
