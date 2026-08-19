# SPEC 08 — Arkanoid en la plataforma

> **Status:** Aprobado
> **Depends on:** 05-asteroides-jugable, 06-leaderboard-y-tabla-de-juegos, 07-tetris
> **Date:** 2026-08-18
> **Objective:** Portar el Arkanoid de `references/started-games/04-arkanoid` a `lib/games/arkanoid/`, montarlo en `/juegos/arkanoid/jugar` como tercera entrada del registro de juegos jugables, y renombrar el id `bloque-buster` del catálogo a `arkanoid`.

## Por qué existe este spec

El spec 07 creó el registro `lib/games/registry.ts` precisamente para que el tercer
juego fuera una entrada y no un refactor. Este spec es la primera prueba de que
eso se cumple: `app/juegos/[id]/jugar/page.tsx` **no se toca**.

Lo que sí trae de nuevo respecto a los dos ports anteriores:

- Es el primer juego con **assets binarios**. Asteroides y Caída dibujan con
  primitivas de canvas; Arkanoid tiene un spritesheet PNG que carga asíncrono, y
  eso añade un estado previo a `ready` que el contrato del motor no contemplaba.
- Es el primer juego cuyo bucle original avanza **por frame**. El de Caída ya
  acumulaba milisegundos y el de Asteroides ya era delta-time. Aquí hay que
  convertir, y la conversión toca la física.
- Es el primer **renombrado de id** del catálogo. El skill `nuevo-juego` lo marca
  como el caso delicado porque `scores.game_id` tiene FK a `games.id`.

## Scope

**In:**

- Renombrado del id `bloque-buster` a `arkanoid` en `lib/games.ts`, con
  `title: "ARKANOID"`. La URL pública pasa a ser `/juegos/arkanoid` y
  `/juegos/arkanoid/jugar`. Del id anterior no queda ninguna aparición fuera de
  `references/`, de `supabase/migrations/0002_games_scores.sql` y de los specs 01
  y 06, que son registro histórico y no se reescriben.
- Reescritura del texto `long` de la entrada, que hoy promete partida infinita
  («¿Hasta dónde llegará tu racha?») cuando el juego real termina al superar el
  nivel 5.
- Migración `supabase/migrations/0004_arkanoid_playable.sql` que renombra la fila
  de `public.games` y la marca jugable, aplicada con `apply_migration` del MCP.
- Contrato propio del juego en `lib/games/arkanoid/types.ts`, en paralelo al de
  Asteroides y al de Caída. Su `GameSnapshot` no tiene campos extra: son
  exactamente los cuatro de `PlayedSnapshot`.
- Port del cargador de sprites en `lib/games/arkanoid/sprites.ts`: las regiones
  `SPRITES`, los `EXPLOSION_FRAMES` de los cinco colores, `EXPLOSION_DURATION` y
  una `loadSpritesheet()` que devuelve una promesa y cachea la imagen.
- Motor puro en `lib/games/arkanoid/engine.ts`: puerto de las 352 líneas de
  `game.js` sin globals de módulo, sin DOM fuera del canvas y sin React. Exporta
  `createArkanoidGame(canvas, options): GameController`.
- Componente cliente `components/games/arkanoid.tsx`, calcado de
  `components/games/caida.tsx`: canvas 800×600, monta el motor, lo destruye al
  desmontar y exporta la leyenda de controles.
- Entrada `arkanoid` en `lib/games/registry.ts`, **sin `extraStats`**.
- El spritesheet copiado a `public/games/arkanoid/spritesheet.png`.
- Estado de carga previo a `ready`: mientras el PNG no está listo el canvas pinta
  fondo negro y `CARGANDO…`, y `Espacio` queda ignorado. Es imposible arrancar
  una partida sin sprites.
- HUD de la plataforma alimentado por el snapshot: **Jugador**, **Puntuación**,
  **Vidas** (3, 2, 1) y **Nivel** (1 a 5). Ningún `hud-stat` propio.
- Pantalla `PULSA ESPACIO PARA EMPEZAR`, overlay `PAUSA`, overlay de nivel
  completado y overlay de fin de partida, los cuatro **dentro del canvas**.
- Pausa con `P` y con `Escape`, más auto-pausa al ocultar la pestaña
  (`visibilitychange`).
- Controles: `←` `→` mover la paleta, `Espacio` empezar / continuar de nivel /
  reiniciar, `P` y `Escape` pausa. Leyenda fija bajo el marco CRT.
- Captura de teclado en `window` con `preventDefault()` en las cuatro flechas y
  en `Space`.
- Se conservan tal cual del original: paleta de 162×14 en `y = 550`, bola de
  radio 8, grilla de 10×5 bloques de 76×24 con 4 px de separación y
  `BLOCK_OFFSET_TOP = 50`, los colores de fila
  `['red', 'yellow', 'green', 'cyan', 'magenta']`, los **cinco patrones de nivel**
  (grilla completa, huecos alternos, pirámide, diamante, marco), **+10 puntos por
  bloque**, **3 vidas**, colisión bola-bloque por punto más cercano con inversión
  del eje de mayor penetración, y la explosión de 4 frames por color que dura
  150 ms.

**Out of scope (for future specs):**

- Sonido: los dos `.mp3` de `assets/sounds/` y la función `playSound()`.
- El control de volumen con `+` / `-`.
- El selector de nivel con las teclas `1`-`5` del original, que además reseteaba
  score y vidas. Es dificultad ajustable y distorsionaría el leaderboard, igual
  que el selector de nivel inicial que el spec 07 dejó fuera.
- Renombrar la clase de portada `.cover-bricks` a `.cover-arkanoid`.
- Power-ups, bloques multi-impacto, bloques indestructibles y paleta con láser.
- Control con ratón o táctil, y canvas responsive.
- Cualquier cambio en `app/juegos/[id]/jugar/page.tsx`, en `lib/scores.ts`, en la
  escritura de `scores` o en las tres pantallas de ranking.
- Cualquier cambio en `lib/games/asteroides/`, `components/games/asteroides.tsx`,
  `lib/games/caida/` y `components/games/caida.tsx`.
- Tests automatizados: no hay test runner en el repo.

## Data model

### `lib/games.ts` — renombrado del catálogo

```ts
{
  id: "arkanoid",        // antes "bloque-buster"
  title: "ARKANOID",     // antes "BLOQUE BUSTER"
  short: "Rebota la pelota y destruye muros de neón.",  // sin cambios
  long: "...",           // reescrito: 5 niveles, 3 vidas, la bola acelera
  cat: "ARCADE",         // sin cambios
  cover: "cover-bricks", // sin cambios: la clase describe el dibujo, no el id
  color: "cyan",         // sin cambios
  best: 28450,           // sin cambios: decorativos
  plays: "12.4K",        // sin cambios: decorativos
}
```

El nuevo `long` debe decir lo que el juego hace de verdad: cinco niveles con
patrones distintos, tres vidas, la bola acelera al cambiar de nivel y superar el
quinto es ganar.

### `lib/games/arkanoid/types.ts` — contrato propio

```ts
export type GameStatus = "ready" | "playing" | "dead" | "paused" | "gameover";

export type GameSnapshot = {
  status: GameStatus;
  score: number;
  lives: number;   // 3, 2, 1, 0
  level: number;   // 1 a 5
};

export type EngineOptions = { onState: (snapshot: GameSnapshot) => void };

export type GameController = {
  start: () => void;
  pause: () => void;
  resume: () => void;
  restart: () => void;
  destroy: () => void;
};
```

Los cuatro campos del snapshot son exactamente los de `PlayedSnapshot`. Este es
el primer juego que no añade ninguno.

### `lib/games/arkanoid/sprites.ts` — port de `assets/spritesheet.js`

```ts
export type SpriteRect = { sx: number; sy: number; sw: number; sh: number };

export const SPRITES: {
  paddle: SpriteRect;                          // 32,112 · 162×14
  ball: SpriteRect;                            // 32,32  · 16×16
  blocks: Record<BlockColor, SpriteRect>;      // 32,sy  · 32×16
};

export const EXPLOSION_FRAMES: Record<BlockColor, SpriteRect[]>;  // 4 por color
export const EXPLOSION_DURATION = 150;  // ms

/** Cachea la imagen a nivel de módulo: es un recurso inmutable compartido, no
 *  estado de partida. Dos motores simultáneos comparten una sola descarga. */
export function loadSpritesheet(): Promise<HTMLImageElement>;
```

`BlockColor` es `"red" | "yellow" | "green" | "cyan" | "magenta"`. Los colores
`hotpink` y `gray` del original existen en el sheet pero ninguna fila los usa, y
no se portan.

### `lib/games/arkanoid/engine.ts` — estado interno (privado)

`paddle` (`{ x, y, width, height }`), `ball` (`{ x, y, radius, dx, dy }`),
`blocks` (array de `{ x, y, width, height, color, destroyed }`), `explosions`
(array de `{ x, y, width, height, color, elapsed }`), `lives`, `score`,
`currentLevel`, `status`, `phase`, `outcome`, `sheet`, más las funciones portadas
`createBlocks`, `resetPaddleAndBall`, `initGame`, `advanceLevel`, `update(dt)`,
`draw()` y `emitState()`.

### Constantes y conversión a delta-time

Todo lo que en el original era por frame se multiplica por 60, que es la
velocidad a la que el juego se diseñó:

| Concepto | Original (por frame) | Motor (por segundo) |
| --- | --- | --- |
| Velocidad de la paleta | `7` | `PADDLE_SPEED = 420` |
| Velocidad de la bola, nivel 1 | `dx = 4, dy = -4` (módulo ≈ 5,657) | `BALL_SPEED = Math.hypot(4, 4) * 60` ≈ 339,4 |
| Velocidad de la bola, nivel N | — | `BALL_SPEED * 1.1 ** (N - 1)` |

El `dt` se capa a 50 ms, como en Asteroides y Caída. En el nivel 5 la bola va a
≈ 497 px/s.

Constantes que **no** cambian: `PADDLE_W = 162`, `PADDLE_H = 14`,
`PADDLE_Y = 550`, `BALL_R = 8`, `BLOCK_COLS = 10`, `BLOCK_ROWS = 5`,
`BLOCK_W = 76`, `BLOCK_H = 24`, `BLOCK_PADDING = 4`, `BLOCK_OFFSET_TOP = 50`,
`BLOCK_OFFSET_LEFT = 2` (calculado, no escrito a mano), `POINTS_PER_BLOCK = 10`,
`START_LIVES = 3`.

### Rebote angular en la paleta

Única desviación deliberada de la física del original, que solo hacía
`ball.dy = -ball.dy` y dejaba la bola clavada a 45° sin que el jugador pudiera
dirigirla:

```ts
const hit = clamp((ball.x - (paddle.x + PADDLE_W / 2)) / (PADDLE_W / 2), -1, 1);
const angle = hit * MAX_BOUNCE_ANGLE;   // MAX_BOUNCE_ANGLE = 60° en radianes
ball.dx = speed * Math.sin(angle);
ball.dy = -speed * Math.cos(angle);
```

`speed` es la velocidad del nivel actual, así que el rebote **conserva el módulo**
y solo cambia la dirección. El lanzamiento inicial y el de cada vida sigue siendo
a 45° hacia arriba y a la derecha, como el original. Los rebotes contra paredes y
contra bloques siguen siendo inversión simple del eje correspondiente.

### Recuento de bloques por nivel

| Nivel | Patrón | Bloques |
| --- | --- | --- |
| 1 | grilla completa | 50 |
| 2 | huecos alternos | 44 |
| 3 | pirámide | 30 |
| 4 | diamante | 34 |
| 5 | marco hueco | 26 |

184 bloques en total: la puntuación máxima de una partida perfecta es **1840**.

### Estados y fases

El contrato solo admite los cinco estados de `PlayedStatus`, y el original tiene
seis situaciones. El mapeo es:

| Situación del original | `status` emitido | Nota |
| --- | --- | --- |
| — | `ready` | `PULSA ESPACIO PARA EMPEZAR` |
| `gameState === 'playing'`, `paused === false` | `playing` | |
| Vida perdida | — | Nunca se emite `dead`: la reaparición es instantánea |
| `paused === true` | `paused` | `phase = "playing"` |
| `gameState === 'levelComplete'` | `paused` | `phase = "levelComplete"` |
| `gameState === 'lost'` | `gameover` | `outcome = "lost"` |
| `gameState === 'won'` | `gameover` | `outcome = "won"` |

`phase` y `outcome` son **internos**: no salen en el snapshot, solo eligen qué
overlay se pinta. El estado `dead` queda declarado en el tipo por contrato pero
el motor nunca entra en él, igual que en Caída.

### Convenciones

- Canvas fijo `W = 800`, `H = 600`, escalado por CSS con `.game-canvas`.
- Las explosiones acumulan `elapsed += dt` en vez de leer `performance.now()`
  como el original, para que se congelen durante la pausa.
- `onState` solo se invoca cuando el snapshot cambia, comparando los cuatro
  campos uno a uno. Todos son enteros: no hace falta redondear como en
  Asteroides.
- La autorrepetición del teclado se **conserva** en `←` y `→`, que es lo que da
  el desplazamiento continuo de la paleta, y se **bloquea** con `e.repeat` en
  `Espacio`.
- Al entrar en `ready`, en `gameover` o en `phase = "levelComplete"`, `Espacio`
  queda ignorado hasta que se suelte.
- Puntuación y vidas **no** se reinician al cambiar de nivel: se arrastran hasta
  el fin de la partida.

## Implementation plan

1. Renombrar el id en `lib/games.ts` (`arkanoid` / `ARKANOID`) y reescribir su
   `long`. Escribir y aplicar `supabase/migrations/0004_arkanoid_playable.sql`
   con el `update public.games set id = 'arkanoid', title = 'ARKANOID',
   playable = true where id = 'bloque-buster'`. Test: `execute_sql` muestra la
   fila `arkanoid` con `playable = true` y ninguna `bloque-buster`;
   `/juegos/arkanoid` carga la ficha con el texto nuevo y `/games` muestra la
   tarjeta con su portada.
2. Copiar el PNG a `public/games/arkanoid/spritesheet.png` y crear
   `lib/games/arkanoid/sprites.ts` con `SPRITES`, `EXPLOSION_FRAMES`,
   `EXPLOSION_DURATION` y `loadSpritesheet()`. Test: `npm run lint` y
   `npm run build` pasan.
3. Crear `lib/games/arkanoid/types.ts` y el esqueleto de
   `lib/games/arkanoid/engine.ts`: obtiene el contexto 2D, pinta el fondo y
   devuelve un `GameController` con los cinco métodos vacíos. Test: importarlo no
   rompe el build.
4. Portar el modelo del campo de juego: las constantes, `LEVELS` con los cinco
   patrones, `createBlocks`, `resetPaddleAndBall` e `initGame`, con tipos
   explícitos y todo dentro de la closure.
5. Portar el dibujo: fondo, paleta, bola, bloques y explosiones, todo con
   `drawImage` desde el sheet. **Sin ningún `fillText` de score, nivel ni iconos
   de vida**, que es lo que el original pintaba en el canvas y aquí pinta el HUD
   de React.
6. Portar `update(dt)`: movimiento de la paleta con clamp a los bordes,
   movimiento de la bola, rebotes contra las tres paredes, rebote angular en la
   paleta, colisión con bloques (`+10`, explosión, inversión del eje de mayor
   penetración, `break`), pérdida de vida al salir por abajo y detección de nivel
   limpio.
7. Implementar el bucle y el ciclo de vida: `start`, `pause`, `resume`,
   `restart`, `destroy`, los listeners de teclado en `window` con
   `preventDefault`, el `visibilitychange` que auto-pausa y `P` / `Escape`.
   `destroy()` cancela el `requestAnimationFrame`, quita todos los listeners y es
   idempotente.
8. Implementar la carga del sheet: `status` arranca en `ready` con un flag
   `spritesReady = false`, se llama a `loadSpritesheet()` y al resolver se marca
   el flag. Si el motor ya fue destruido cuando resuelve la promesa, no se toca
   nada. Test manual: con el throttling de las devtools se ve `CARGANDO…` y
   `Espacio` no arranca hasta que desaparece.
9. Implementar `emitState()`: compone el `GameSnapshot`, lo compara con el
   anterior campo a campo y llama a `onState` solo si difiere.
10. Añadir los cuatro overlays dentro del canvas: `CARGANDO…`,
    `PULSA ESPACIO PARA EMPEZAR`, `PAUSA`, `NIVEL N COMPLETADO · ESPACIO PARA
    CONTINUAR`, y el de fin de partida, que es `GAME OVER` con `outcome = "lost"`
    y `¡NIVELES COMPLETADOS!` con `outcome = "won"`, ambos con la puntuación
    final y `ESPACIO PARA REINICIAR`.
11. Crear `components/games/arkanoid.tsx` con su leyenda de controles y añadir la
    entrada `arkanoid` al registro con `definePlayable<GameSnapshot>`, sin
    `extraStats`. Test manual: el juego es jugable en `/juegos/arkanoid/jugar` y
    el HUD responde.
12. Verificación final: `npm run lint`, `npm run build` y la checklist de
    `.claude/skills/nuevo-juego/references/checklist.md` completa, incluida la
    partida guardada en `scores` con sesión real.

## Acceptance criteria

### Build y renombrado

- [ ] `npm run lint` y `npm run build` pasan sin errores.
- [ ] No queda ninguna aparición de `bloque-buster` en el repo fuera de
      `references/`, de `supabase/migrations/0002_games_scores.sql` y de
      `specs/01-mvp-visual.md` y `specs/06-leaderboard-y-tabla-de-juegos.md`.
- [ ] El diff de la rama **no toca** `app/juegos/[id]/jugar/page.tsx`,
      `lib/scores.ts`, `lib/games/types.ts`, ni ningún archivo de
      `lib/games/asteroides/`, `lib/games/caida/`, `components/games/asteroides.tsx`
      o `components/games/caida.tsx`.
- [ ] `public.games` tiene la fila `arkanoid` con `playable = true`, no tiene
      `bloque-buster`, y la migración `0004` está commiteada.
- [ ] Asteroides y Caída siguen funcionando exactamente igual que antes.

### Catálogo y rutas

- [ ] `/games` muestra la tarjeta **ARKANOID** con su portada `cover-bricks`.
- [ ] `/juegos/arkanoid` carga la ficha, y el texto `long` menciona los 5 niveles,
      las 3 vidas y que la bola acelera.
- [ ] `/juegos/arkanoid/jugar` muestra el canvas dentro del marco CRT.
- [ ] `/juegos/ranaria/jugar` sigue mostrando el `game-arena` decorativo.

### Carga de sprites

- [ ] Con la red ralentizada en las devtools, el canvas muestra `CARGANDO…` y
      `Espacio` no arranca la partida.
- [ ] Cuando el sheet carga, el overlay pasa a `PULSA ESPACIO PARA EMPEZAR` sin
      recargar la página.
- [ ] Entrar y salir de la ruta varias veces descarga el PNG **una sola vez**
      (pestaña Network, el resto son de caché).

### Ciclo de partida

- [ ] Al entrar, el juego **no** corre: la bola no se mueve.
- [ ] `Espacio` arranca la partida con 3 vidas, 0 puntos, nivel 1 y los 50
      bloques de la grilla completa.
- [ ] `←` y `→` mueven la paleta, y mantener la tecla la desplaza de forma
      continua sin salirse del canvas por ninguno de los dos lados.
- [ ] Pulsar flechas o `Espacio` durante la partida **no** hace scroll de la
      página.
- [ ] Destruir un bloque suma exactamente **10** puntos y lanza su explosión de 4
      frames del color de su fila.
- [ ] La bola rebota en el punto de impacto de la paleta: golpear con el extremo
      izquierdo la manda a la izquierda y con el centro la manda casi vertical.
- [ ] La velocidad total de la bola no cambia al rebotar en la paleta.
- [ ] Perder la bola por abajo resta una vida y recoloca paleta y bola al
      instante, sin pausa intermedia.
- [ ] Limpiar un nivel muestra `NIVEL N COMPLETADO · ESPACIO PARA CONTINUAR`
      dentro del canvas, y `Espacio` carga el siguiente patrón conservando
      puntuación y vidas.
- [ ] Los cinco patrones aparecen en orden: grilla, huecos alternos, pirámide,
      diamante, marco.
- [ ] La bola va visiblemente más rápida en el nivel 5 que en el nivel 1.
- [ ] Perder la última vida muestra `GAME OVER` dentro del canvas con la
      puntuación final, y `Espacio` reinicia desde cero.
- [ ] Limpiar el nivel 5 muestra `¡NIVELES COMPLETADOS!` con la puntuación final,
      y `Espacio` reinicia desde cero.
- [ ] Mantener `Espacio` pulsado no encadena acciones: no salta de nivel dos
      veces ni reinicia nada más morir.
- [ ] `P` y `Escape` muestran el overlay `PAUSA` y congelan bola, paleta y
      explosiones; al reanudar la bola no da un salto de posición.
- [ ] Cambiar a otra pestaña pausa el juego; al volver sigue en pausa.
- [ ] `P` no hace nada mientras está el overlay de nivel completado.
- [ ] El canvas se ve completo y sin deformarse al estrechar la ventana (4:3).

### HUD

- [ ] Puntuación, Vidas y Nivel se actualizan en tiempo real.
- [ ] **No** hay score, nivel ni iconos de vida dibujados dentro del canvas.
- [ ] No aparece ningún `hud-stat` propio de este juego.
- [ ] Muestra el `username` real con sesión y `INVITADO` sin ella.

### Limpieza

- [ ] Salir con SALIR o VOLVER AL VAULT detiene el bucle: no quedan
      `requestAnimationFrame` activos ni listeners, y las flechas no producen
      efectos en otra página.
- [ ] En dev (Strict Mode, doble montaje) la bola no va al doble de velocidad ni
      la paleta responde dos veces a una tecla.
- [ ] Entrar en la ruta y salir antes de que el PNG termine de cargar no produce
      ningún error en consola.
- [ ] El profiler de React no muestra renders continuos mientras se juega.

### Leaderboard

- [ ] Con sesión real, terminar una partida crea **exactamente una** fila en
      `scores` con `game_id = 'arkanoid'`, el score final, el nivel alcanzado y la
      duración en segundos.
- [ ] Ganar la partida (nivel 5 limpio) también crea su fila, con `level = 5`.
- [ ] Reiniciar con `Espacio` y volver a terminar crea una **segunda** fila.
- [ ] Como invitado o sin sesión no se crea ninguna fila y no hay errores en
      consola.
- [ ] Salir antes del fin de partida no crea ninguna fila.
- [ ] Cortando la red aparece `NO SE PUDO GUARDAR` en el HUD y el juego se sigue
      pudiendo reiniciar.
- [ ] En `/juegos/arkanoid` la marca real encabeza la tabla, el relleno `CPU` va
      debajo atenuado y los rangos van del 01 al 10 sin saltos.
- [ ] La pestaña de Arkanoid en `/salon-de-la-fama` muestra sus 12 filas.
- [ ] `get_advisors` no reporta advertencias de seguridad nuevas.

## Decisiones

- **Sí:** renombrar `bloque-buster` a `arkanoid`. Decisión del usuario. El id
  tenía 0 filas en `scores` y `playable = false`, así que el `update` de la FK es
  seguro y no hay ninguna puntuación que arrastrar. Hacerlo ahora, antes de que
  el juego sea jugable, es la única ventana barata.
- **No:** renombrar la clase `.cover-bricks` a `.cover-arkanoid`. En este repo
  solo Asteroides tiene la clase nombrada por su id; las demás describen el
  dibujo (`cover-tetro` para Caída, `cover-snake`, `cover-glot`, `cover-rana`).
  `cover-bricks` sigue describiendo lo que pinta.
- **Sí:** reescribir el texto `long`. La frase «¿Hasta dónde llegará tu racha?»
  promete partida infinita y el juego termina en el nivel 5. Mismo precedente que
  los OVNIs inexistentes de Asteroides y la pieza tuerca de Caída.
- **Sí:** copiar el spritesheet y portar el loader. Decisión del usuario, contra
  la alternativa de redibujar todo en neón vectorial al estilo de Asteroides y
  Caída. Portar significa portar: el juego se ve como su original, incluidas las
  explosiones de 4 frames. Contrapartida asumida: es el primer asset binario del
  repo y añade un estado de carga que los otros dos juegos no tienen.
- **No:** redibujar con primitivas de canvas. Habría sido más coherente con la
  estética del vault y sin assets, pero las explosiones dejarían de ser las del
  original.
- **Sí:** cachear la imagen a nivel de módulo en `sprites.ts`. Es la única
  excepción a la regla de «nada de globals de módulo» del contrato, y está
  justificada: es un recurso inmutable y compartido, no estado de partida. Sin
  ella, el doble montaje del Strict Mode descarga el PNG dos veces.
- **Sí:** convertir el bucle a delta-time multiplicando por 60. Decisión del
  usuario. Es lo que prefiere la plataforma y lo que hace que la auto-pausa al
  ocultar la pestaña funcione. A 60 fps la sensación es idéntica al original; en
  pantallas de 120 Hz el original iba al doble de velocidad.
- **No:** conservar el bucle por frame. Fiel al original solo en máquinas de
  60 Hz, y roto en todas las demás.
- **Sí:** rebote angular según el punto de impacto en la paleta, con 60° de
  apertura máxima. Decisión del usuario. Es la desviación más grande respecto al
  original, que solo invertía `dy` y dejaba la bola clavada a 45° sin que el
  jugador pudiera dirigirla; con la grilla del nivel 1 eso produce trayectorias
  cíclicas que no alcanzan los bloques que faltan y alargan la partida sin
  jugabilidad. El módulo de la velocidad se conserva, así que la curva de
  dificultad no se toca por este lado.
- **Sí:** la bola acelera un 10 % por nivel. Decisión del usuario. Los patrones
  van a menos (50, 44, 30, 34, 26 bloques): sin acelerar, el nivel 1 sería el más
  difícil de los cinco y la partida iría cuesta abajo.
- **Sí:** ganar emite `gameover` con overlay propio. Decisión del usuario. Es el
  único estado que dispara el guardado en `scores`, así que una victoria que no
  emitiera `gameover` sería la única partida que no se guarda, justo la mejor.
- **No:** ciclo infinito de niveles ni repetición del nivel 5. Darían recorrido al
  leaderboard, pero son jugabilidad que el original no tiene.
- **Sí:** conservar la espera de `Espacio` entre niveles. Decisión del usuario,
  fiel al `levelComplete` del original. Contrapartida: `Espacio` pasa a tener
  cuatro significados según el estado, y hace falta la guardia de soltar la tecla
  en tres de ellos.
- **Sí:** representar `levelComplete` como `status: "paused"` con un `phase`
  interno. El contrato solo admite cinco estados y añadir un sexto rompería el
  encaje estructural con `PlayedSnapshot`. `paused` es además semánticamente
  correcto —el juego está congelado esperando al jugador— y la página ya trata la
  vuelta de `paused` a `playing` como la misma partida, que es exactamente lo que
  es.
- **No:** reutilizar `dead` para el nivel completado. El estado está libre porque
  la reaparición es instantánea, pero llamar «muerto» a haber ganado un nivel es
  mentir en el tipo.
- **Sí:** reaparición instantánea al perder una vida, sin pasar por `dead`.
  Decisión del usuario, fiel al original.
- **Sí:** overlay `CARGANDO…` bloqueante. Decisión del usuario. El original hace
  `return` silencioso en `drawSprite` si el sheet no ha cargado, lo que aquí
  dejaría arrancar una partida invisible.
- **Sí:** solo `←` y `→`. Decisión del usuario. Ni alias `A`/`D` ni ratón: el
  ratón además desequilibraría un leaderboard compartido con quien juegue a
  teclado.
- **Sí:** ningún `hud-stat` propio. Decisión del usuario. Este juego sí usa las
  Vidas, a diferencia de Caída, así que el HUD base no tiene huecos que rellenar.
- **Sí:** `P` y `Escape` para pausar, como Caída. Es el precedente más reciente.
- **Sí:** las explosiones acumulan `elapsed += dt`. El original lee
  `performance.now()`, que sigue corriendo durante la pausa y haría desaparecer
  las explosiones congeladas.
- **No:** portar los colores `hotpink` y `gray` del spritesheet. Existen en el
  sheet pero ninguna fila de ningún nivel los usa.
- **No:** copiar el `canvas` intermedio del loader original, que redibujaba el PNG
  en un canvas offscreen. No tiene efecto visual y `drawImage` acepta la `Image`
  directamente.

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| La promesa de `loadSpritesheet()` resuelve **después** de que el componente se haya desmontado y `destroy()` haya corrido. Es el caso normal en dev con Strict Mode, y escribir en el estado del motor ahí deja listeners o dibujos huérfanos. | El paso 8 comprueba el flag de destruido antes de tocar nada al resolver. Hay criterio de aceptación sobre entrar y salir de la ruta durante la carga. |
| `Espacio` tiene cuatro significados según el estado (arrancar, continuar de nivel, reiniciar, y nada mientras se juega). Un fallo aquí salta un nivel o reinicia una partida por accidente. | Guardia de `e.repeat` más la regla de soltar la tecla al entrar en `ready`, en `gameover` y en `phase = "levelComplete"`. Hay criterio de aceptación específico. |
| El rebote angular puede dejar la bola casi horizontal si se golpea con el extremo de la paleta, y con `dy` mínimo la bola tarda muchísimo en bajar. | La apertura máxima es 60° respecto a la vertical, no 90°: `dy` nunca baja de la mitad de la velocidad total. |
| Convertir a delta-time cambia la resolución del movimiento: con `dt` grande la bola avanza varios píxeles por paso y puede **atravesar** un bloque o la paleta sin detectar la colisión. A 340 px/s y `dt` capado a 50 ms son 17 px por paso, contra una paleta de 14 px de alto. | El capado de `dt` a 50 ms es el mismo de los otros dos juegos. La colisión con la paleta se comprueba por banda (`ball.y + radius` entre `paddle.y` y `paddle.y + height`) y con `ball.dy > 0`, como el original; si en pruebas manuales se detecta traspaso, se corrige antes de cerrar el paso 6. |
| La grilla del nivel 1 tiene 50 bloques y la bola solo puede romper uno por frame (`break` tras la primera colisión). Con la bola acelerada del nivel 5 el `break` puede hacer que se ignore una segunda colisión real en el mismo paso. | Es el comportamiento del original y se conserva. El efecto visible es como mucho un bloque que sobrevive un frame de más. |
| El PNG son 30 KB en `public/`, servido sin hash de contenido. Si algún día se reemplaza, los navegadores con caché seguirán mostrando el viejo. | Aceptado: es un asset que no va a cambiar. Si cambiara, se renombra el archivo. |
| Renombrar el id rompe cualquier enlace externo a `/juegos/bloque-buster`. | Aceptado: el juego no era jugable, no tiene puntuaciones y la ruta no se ha compartido. No se añade redirección. |
| `Partidas` y `Mejor global` de `/juegos/arkanoid` pasan de "12.4K" y 28450 a los valores reales en cuanto alguien termine una partida. | Es el comportamiento definido en el spec 06. No es un bug. |

## What is **not** in this spec

- Sonido, control de volumen y los dos `.mp3` del original.
- El selector de nivel con las teclas `1`-`5`.
- Power-ups, bloques multi-impacto o indestructibles, y paleta con láser.
- Control con ratón, táctil y canvas responsive.
- Renombrar `.cover-bricks`.
- Redirección de la ruta antigua `/juegos/bloque-buster`.
- Cambios en la página de juego, en la escritura o la lectura de `scores`, o en
  los otros dos juegos.
- Tests automatizados.

Cada uno de estos, si se implementa, va en su propio spec.
