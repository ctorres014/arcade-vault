# SPEC 07 — Tetris en la plataforma

> **Status:** implementado
> **Depends on:** 05-asteroides-jugable, 06-leaderboard-y-tabla-de-juegos
> **Date:** 2026-08-15
> **Objective:** Portar el Tetris de `references/started-games/03-claude-tetris` a `lib/games/caida/`, montarlo en `/juegos/caida/jugar` con el HUD y el guardado de puntuaciones que ya existen, y generalizar la página de juego con un registro de juegos jugables, porque este es el segundo.

## Scope

**In:**

- Registro de juegos jugables en `lib/games/registry.ts`, que sustituye al `game.id === "asteroides"` incrustado hoy en `app/juegos/[id]/jugar/page.tsx`. Mapea `id` → componente del juego, leyenda de controles y `hud-stat` propios.
- Vista mínima común en `lib/games/types.ts`: `PlayedSnapshot` (`status`, `score`, `lives`, `level`), que es lo único que la página necesita para pintar el HUD base y para guardar la partida. **No es un contrato que los juegos implementen**, sino un supertipo estructural que ambos snapshots ya satisfacen.
- **Cero cambios en `lib/games/asteroides/` y en `components/games/asteroides.tsx`.** Cada juego conserva su propio contrato: Asteroides mantiene su `GameSnapshot` con `tripleShotLeft` y Caída define el suyo. Lo único que se mueve de Asteroides es su `hud-stat` de `3x`, que pasa de estar escrito a mano en la página a declararse en su entrada del registro.
- Motor puro en `lib/games/caida/engine.ts`: puerto de las 639 líneas de `game.js` sin globals de módulo, sin DOM fuera del canvas y sin React. Exporta `createCaidaGame(canvas, options): GameController`.
- Contrato propio de Caída en `lib/games/caida/types.ts`: su `GameSnapshot` con `lines` y `combo` como campos de primera clase, más sus `EngineOptions` y su `GameController`.
- Componente cliente `components/games/caida.tsx`, calcado de `components/games/asteroides.tsx`: canvas 800×600, monta el motor, lo destruye al desmontar y exporta la leyenda de controles.
- Layout dentro del canvas único de 800×600: tablero de 10×20 celdas de 30 px (300×600) a la izquierda del centro, y a su derecha el panel **SIGUIENTE** con la vista previa de la próxima pieza. El segundo canvas de 120×120 del original desaparece.
- HUD de la plataforma alimentado por el snapshot: **Jugador**, **Puntuación**, **Vidas** (siempre `—`, Caída no tiene vidas), **Nivel**, más dos `hud-stat` propios de este juego: **Líneas** y **Combo**, este último visible solo cuando el combo es mayor que cero.
- Pantalla de inicio `PULSA ESPACIO PARA EMPEZAR`, overlay `PAUSA` y `GAME OVER` con la puntuación final y `ESPACIO PARA REINICIAR`, los tres **dentro del canvas**.
- Pausa con `P` y con `Escape`, más auto-pausa al ocultar la pestaña (`visibilitychange`).
- Controles: `←` `→` mover, `↓` bajar una fila (soft drop), `↑` o `X` rotar, `Espacio` soltar de golpe (hard drop), `P` / `Escape` pausa. Leyenda fija bajo el marco CRT.
- Captura de teclado en `window` con `preventDefault()` en las cuatro flechas y `Space`.
- Migración `supabase/migrations/0003_caida_playable.sql` con `update public.games set playable = true where id = 'caida'`, aplicada con `apply_migration` del MCP.
- Reescritura del texto `long` de `caida` en `lib/games.ts` para mencionar la pieza "tuerca", que el texto actual omite.
- Se conservan tal cual del original: las 7 piezas estándar **más la pieza "tuerca"** 3×3 hueca (sorteo uniforme de 1 a 8), la paleta `COLORS`, la rotación por transposición con kicks `[0, -1, 1, -2, 2]` sin SRS, la pieza fantasma al 20 % de opacidad, `LINE_SCORES = [0, 100, 300, 500, 800]` multiplicado por el nivel, hard drop a 2 puntos por celda, soft drop a 1 punto por fila, `level = floor(lines / 10) + 1`, `dropInterval = max(100, 1000 - (level - 1) * 90)` y el contador de combo.

**Out of scope (for future specs):**

- El Top 5 en `localStorage` con entrada de nombre del original: la plataforma ya tiene leaderboard real en Supabase desde el spec 06.
- Las mejores marcas locales de combo y de líneas de una vez (`bestCombo`, `bestLines`), y el botón de borrarlas.
- Los cuatro skins (`retro`, `neon`, `pastel`, `pixel`) y el toggle de tema claro/oscuro. Se porta solo la paleta `retro`.
- El selector de nivel inicial (1–10). Decisión del usuario: es dificultad ajustable y además distorsionaría el leaderboard.
- Cualquier cambio en la escritura de `scores`, en `lib/scores.ts` o en las tres pantallas de ranking: ya son genéricas por `game_id`.
- Sonido, controles táctiles, canvas responsive y hold de pieza.
- Portar Arkanoid desde `references/started-games/04-arkanoid`. Va en su propio spec, reutilizando el registro que crea este.
- Tests automatizados: no hay test runner en el repo.

## Data model

`lib/games/types.ts` — la vista mínima que la página necesita de cualquier juego. Cada juego sigue teniendo su propio contrato en su carpeta; esto solo describe la intersección:

```ts
export type PlayedStatus = "ready" | "playing" | "dead" | "paused" | "gameover";

/**
 * Supertipo estructural: ningún motor lo importa ni lo implementa. Los snapshots
 * de Asteroides y de Caída encajan aquí por tener estos cuatro campos, y así la
 * página pinta el HUD base y guarda la partida sin conocer ningún juego.
 */
export type PlayedSnapshot = {
  status: PlayedStatus;
  score: number;
  lives: number;
  level: number;
};

export type HudStat = { label: string; value: string };
```

`lib/games/registry.ts` — lo que la página necesita saber de cada juego jugable:

```ts
export type PlayableGame = {
  Game: ComponentType<{ onSnapshot?: (s: PlayedSnapshot) => void }>;
  Controls: ComponentType;
  /** hud-stat propios del juego. Devuelve [] cuando no hay nada que mostrar. */
  extraStats?: (s: PlayedSnapshot) => HudStat[];
};

/**
 * Cada entrada se declara con el snapshot de SU juego, ya tipado. El helper
 * concentra en un único punto la conversión a la vista común: en tiempo de
 * ejecución el snapshot que recibe `extraStats` siempre viene del motor de ese
 * mismo juego.
 */
export function definePlayable<S extends PlayedSnapshot>(entry: {
  Game: ComponentType<{ onSnapshot?: (s: S) => void }>;
  Controls: ComponentType;
  extraStats?: (s: S) => HudStat[];
}): PlayableGame;

export const PLAYABLE: Record<string, PlayableGame> = {
  asteroides: definePlayable<AsteroidesSnapshot>({ ... }),
  caida: definePlayable<CaidaSnapshot>({ ... }),
};
```

`lib/games/caida/types.ts` — contrato propio del juego, en paralelo al de Asteroides:

```ts
export type GameStatus = "ready" | "playing" | "dead" | "paused" | "gameover";

export type GameSnapshot = {
  status: GameStatus;
  score: number;
  lives: number;   // siempre 0: Caída no tiene vidas
  level: number;
  lines: number;   // líneas totales limpiadas en la partida
  combo: number;   // limpiezas consecutivas; vuelve a 0 al fijar sin limpiar
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

Estado interno del motor (privado): `board` (matriz 20×10 de enteros 0–8), `current`, `next` (`{ type, shape, x, y }`), `score`, `lines`, `level`, `combo`, `status`, `dropAccum`, `dropInterval`, más las funciones portadas `createBoard`, `randomPiece`, `collide`, `rotateCW`, `tryRotate`, `merge`, `clearLines`, `ghostY`, `hardDrop`, `softDrop`, `lockPiece`, `spawn` y `endGame`.

Convenciones:

- Canvas fijo `W = 800`, `H = 600`, escalado por CSS con `.game-canvas`, igual que Asteroides.
- Geometría del layout, constantes del motor: `COLS = 10`, `ROWS = 20`, `BLOCK = 30`, tablero dibujado con origen en `BOARD_X = 140`, `BOARD_Y = 0`; panel **SIGUIENTE** con caja de 4×4 celdas de 30 px en `PANEL_X = 560`, `PANEL_Y = 60`. Toda la lógica sigue trabajando en coordenadas de celda: el desplazamiento se aplica solo al pintar.
- El color de la rejilla dejaba de leerse de una variable CSS (`--color-grid-line`) y pasa a ser una constante del motor.
- El bucle del original ya acumula milisegundos (`dropAccum` / `dropInterval`), así que **no** se convierte a píxeles por segundo: se conserva tal cual, añadiendo el capado de `dt` a 50 ms del contrato de la plataforma.
- `lives` es siempre `0` y el HUD pinta `—`. `level` empieza en 1, que es lo que exige la columna `not null` de `scores`.
- El estado `dead` del contrato existe pero **este motor nunca entra en él**: Caída no tiene vidas, se muere una vez.
- `onState` solo se invoca cuando el snapshot cambia, comparando los seis campos uno a uno. Aquí todos los valores son enteros, así que no hace falta redondear como en Asteroides.
- La autorrepetición del teclado se **conserva** en `←`, `→` y `↓`, que es lo que da el desplazamiento continuo al mantener la tecla, y se **bloquea** con `e.repeat` en rotación y en `Espacio`.
- Al entrar en `ready` o en `gameover`, `Espacio` queda ignorado hasta que se suelte, para que morir con la tecla pulsada no reinicie la partida al instante.

Cambio en `lib/games.ts` (entrada existente, solo el texto `long`):

```ts
{
  id: "caida",
  title: "CAÍDA",
  // long reescrito: añade la pieza "tuerca" hueca que el catálogo no menciona.
  // id, cat, cover, color, best y plays se quedan como están.
}
```

## Implementation plan

1. Crear `lib/games/types.ts` con `PlayedStatus`, `PlayedSnapshot` y `HudStat`. Nadie lo usa todavía y no se toca ningún archivo de Asteroides. Test: `npm run lint` y `npm run build` pasan.
2. Crear `lib/games/registry.ts` con `definePlayable`, `PlayableGame` y la entrada de Asteroides (su componente, su leyenda y el `extraStats` del `3x`), y refactorizar `app/juegos/[id]/jugar/page.tsx` para consumirlo: `PLAYABLE[id]` decide si se monta un juego o el `game-arena` decorativo, y los `hud-stat` propios se pintan recorriendo `extraStats`. La página deja de importar de `lib/games/asteroides/types.ts` y pasa a importar `PlayedSnapshot`. Test manual: `/juegos/asteroides/jugar` idéntico al de antes, con su `3x` y su cuenta atrás; `/juegos/caida/jugar` y el resto siguen con el `game-arena`. Test: `git status` no muestra ningún archivo modificado dentro de `lib/games/asteroides/` ni `components/games/asteroides.tsx`.
3. Escribir y aplicar `supabase/migrations/0003_caida_playable.sql` (`playable = true` para `caida`) y reescribir el texto `long` de `caida` en `lib/games.ts`. Test: `execute_sql` muestra `caida` con `playable = true`; la ficha `/juegos/caida` carga con el texto nuevo.
4. Crear `lib/games/caida/types.ts` y el esqueleto de `lib/games/caida/engine.ts`: obtiene el contexto 2D, pinta el fondo y devuelve un `GameController` con los cinco métodos vacíos. Test: importarlo no rompe el build.
5. Portar el modelo del tablero y las piezas: `PIECES` (las 8, tuerca incluida), `COLORS`, `createBoard`, `randomPiece`, `collide`, `rotateCW`, `tryRotate`, `merge` y `ghostY`, con tipos explícitos y sin globals.
6. Portar el estado de partida: `initGame`, `spawn`, `lockPiece`, `clearLines` (con `lines`, `score`, `level`, `dropInterval` y `combo`), `softDrop`, `hardDrop` y `endGame`, que ahora solo pone `status = "gameover"` sin tocar el DOM ni cancelar el bucle.
7. Portar el dibujo: rejilla, tablero fijado, pieza fantasma al 20 %, pieza actual y panel **SIGUIENTE**, todo desplazado por `BOARD_X` / `PANEL_X` dentro del mismo canvas. Sin `drawHUD` de ningún tipo. Test manual: montado a mano, las piezas caen, rotan y limpian líneas.
8. Implementar el bucle y el ciclo de vida: `start`, `pause`, `resume`, `restart`, `destroy`, los listeners de teclado en `window` con `preventDefault`, el `visibilitychange` que auto-pausa, y `P` / `Escape`. Al reanudar se reinicia `dropAccum` para que la pieza no baje de golpe. `destroy()` cancela el `requestAnimationFrame` y quita todos los listeners.
9. Implementar `emitState()`: compone el `GameSnapshot` de Caída (con `lines` y `combo`), lo compara con el anterior campo a campo y llama a `onState` solo si difiere.
10. Añadir los overlays dentro del canvas: `PULSA ESPACIO PARA EMPEZAR` en `ready`, `PAUSA` en `paused` y `GAME OVER` con la puntuación final y `ESPACIO PARA REINICIAR` en `gameover`, con la regla de soltar `Espacio` antes de que vuelva a contar.
11. Crear `components/games/caida.tsx` con su leyenda de controles y añadir la entrada `caida` al registro con `definePlayable<GameSnapshot>`, con `extraStats` de **Líneas** y **Combo**. Test manual: el juego es jugable en `/juegos/caida/jugar` y el HUD responde.
12. Verificación final: `npm run lint`, `npm run build` y la checklist de `.claude/skills/nuevo-juego/references/checklist.md` completa, incluida la partida guardada en `scores` con sesión real.

## Acceptance criteria

- [ ] `npm run build` y `npm run lint` pasan sin errores.
- [ ] `app/juegos/[id]/jugar/page.tsx` no contiene ninguna comparación literal con `"asteroides"` ni con `"caida"`: los juegos jugables salen de `PLAYABLE`.
- [ ] El diff de la rama **no toca ningún archivo** de `lib/games/asteroides/` ni `components/games/asteroides.tsx`.
- [ ] Asteroides sigue funcionando exactamente igual que antes de este spec, con su `hud-stat` de `3x` y su cuenta atrás.
- [ ] `lib/games/types.ts` no es importado por ningún motor: solo por el registro y por la página.
- [ ] `/juegos/ranaria/jugar` (y el resto de ids no jugables) sigue mostrando el `game-arena` decorativo.
- [ ] `/juegos/caida/jugar` muestra el tablero y el panel SIGUIENTE dentro del marco CRT, en un único canvas.
- [ ] Al entrar, el juego **no** corre: se ve `PULSA ESPACIO PARA EMPEZAR` y la pieza no cae.
- [ ] `Espacio` arranca la partida en nivel 1, con el tablero vacío y la vista previa poblada.
- [ ] `←` y `→` mueven la pieza, y mantener la tecla la desplaza de forma continua.
- [ ] `↓` baja una fila y suma 1 punto; `↑` y `X` rotan con los kicks del original; `Espacio` suelta la pieza de golpe y suma 2 puntos por celda recorrida.
- [ ] Mantener `Espacio` pulsado suelta **una** pieza, no una por frame.
- [ ] Pulsar flechas o `Espacio` durante la partida **no** hace scroll de la página.
- [ ] La pieza fantasma se ve proyectada bajo la pieza actual, atenuada.
- [ ] Limpiar 1, 2, 3 y 4 líneas suma 100, 300, 500 y 800 puntos multiplicados por el nivel.
- [ ] Cada 10 líneas sube el nivel y la caída se acelera, hasta el tope de 100 ms.
- [ ] La pieza "tuerca" 3×3 hueca aparece en el sorteo junto a las 7 estándar.
- [ ] El panel SIGUIENTE muestra la pieza que va a entrar, y se actualiza al fijar cada pieza.
- [ ] El HUD refleja puntuación, nivel, **Líneas** y **Combo** en tiempo real, con **Vidas** en `—`, y **no** hay ningún texto de score, líneas ni nivel dibujado dentro del canvas.
- [ ] El **Combo** sube al limpiar líneas consecutivas y desaparece del HUD al fijar una pieza sin limpiar.
- [ ] Cuando la pieza nueva no cabe al entrar, aparece `GAME OVER` **dentro del canvas** con la puntuación final, y `Espacio` reinicia la partida desde cero.
- [ ] Morir con `Espacio` pulsado **no** reinicia la partida hasta soltar y volver a pulsar.
- [ ] `P` y `Escape` muestran el overlay `PAUSA` y congelan la caída; al reanudar, la pieza no baja de golpe.
- [ ] Cambiar a otra pestaña pausa el juego automáticamente.
- [ ] Salir de la ruta detiene el bucle: no quedan `requestAnimationFrame` activos ni listeners, y pulsar flechas en otra página no produce efectos.
- [ ] En desarrollo (Strict Mode, doble montaje) la pieza no cae al doble de velocidad ni responde dos veces a una tecla.
- [ ] La leyenda `← → MOVER · ↓ BAJAR · ↑ / X ROTAR · ESPACIO SOLTAR · P PAUSA` es visible debajo del marco CRT.
- [ ] `public.games` tiene `caida` con `playable = true` y la migración está commiteada.
- [ ] Con sesión real, terminar una partida crea exactamente una fila en `scores` con `game_id = 'caida'`, el score final, el nivel alcanzado y la duración; reiniciar y volver a morir crea una segunda fila.
- [ ] Como invitado no se crea ninguna fila y la partida se juega entera sin errores en consola.
- [ ] La marca real aparece en cabeza en `/juegos/caida`, en la pestaña de Caída del Salón de la Fama y, si procede, en el ranking de la portada, con el relleno `CPU` atenuado debajo.
- [ ] `Partidas` y `Mejor global` de `/juegos/caida` pasan a reflejar los valores reales de `scores`.
- [ ] No queda ninguna referencia a `localStorage`, a skins, a temas ni al selector de nivel en `lib/games/caida/`.
- [ ] `app/juegos/[id]/jugar/page.tsx` no importa nada de `lib/games/caida/` ni de `lib/games/asteroides/`: solo del registro y de `lib/games/types.ts`.

## Decisiones

- **Sí:** registro `lib/games/registry.ts` en vez de encadenar comparaciones por id. Con el segundo juego, el `game.id === "asteroides"` de la página deja de escalar, y Arkanoid solo tendrá que añadir una línea.
- **Sí:** cada juego conserva su propio contrato y Asteroides no se toca. **Decisión del usuario**, contra mi propuesta inicial de unificarlos. El spec 05 está cerrado y verificado, y refactorizar código terminado para acomodar al juego siguiente es riesgo sin beneficio visible. Contrapartidas asumidas: el union de estados (`"ready" | "playing" | ...`) queda escrito en tres sitios, y cada juego nuevo repite las diez líneas de `EngineOptions` y `GameController`.
- **Sí:** vista mínima `PlayedSnapshot` en vez de un contrato que los motores implementen. Es un supertipo estructural: ningún motor lo importa, y los dos snapshots existentes encajan sin cambiar una línea, porque TypeScript compara por forma y no por declaración. Si un juego futuro dejara de tener `score` o `level`, el error saldría en su entrada del registro, en compilación.
- **No:** un `GameSnapshot` compartido con `extra: Record<string, number>`. Era mi propuesta: menos duplicación, pero obliga a migrar Asteroides y pierde el tipado fino de `lines` y `combo`.
- **No:** dejar la página con un `if` por juego. Funciona con dos juegos y se pudre con cuatro.
- **Sí:** helper `definePlayable<S>` en el registro. Cada entrada se escribe con el snapshot de su juego, ya tipado, y la única conversión a la vista común vive dentro del helper, documentada, en lugar de repartir `as` por las entradas.
- **Sí:** conservar la pieza "tuerca". Decisión del usuario. Es lo que hace este Tetris distinto y portar significa portar, no convertirlo en Tetris clásico.
- **Sí:** conservar el contador de combo como `hud-stat`. Decisión del usuario. Es información de partida real y ya está calculada en el original.
- **No:** conservar el Top 5 de `localStorage` con entrada de nombre. La plataforma tiene leaderboard real desde el spec 06; dos rankings a la vez es exactamente la incoherencia que ese spec cerró.
- **No:** conservar skins ni tema claro/oscuro. Necesitan controles fuera del canvas, leen `document.body` y compiten con la estética del marco CRT. Se porta la paleta `retro`.
- **No:** conservar el selector de nivel inicial. Decisión del usuario. Es dificultad ajustable, declarada fuera de alcance en el spec 05, y empezar en nivel 10 multiplicaría la puntuación de una tabla que es común a todos.
- **Sí:** panel SIGUIENTE dentro del canvas único de 800×600. Decisión del usuario. Un segundo canvas obligaría a que el componente maquetase dos superficies dentro del `crt-screen`, y la vista previa es información de juego, no decoración.
- **No:** ampliar el tablero a 800×600 recalculando `BLOCK`. Se vería más grande a cambio de celdas deformadas o de cambiar las proporciones del tablero.
- **Sí:** `lives: 0` con el HUD en `—` y un `hud-stat` de **Líneas**. Decisión del usuario. El hueco de Vidas se resuelve sin tocar el HUD común, y Líneas es la métrica que de verdad gobierna el nivel.
- **No:** ocultar el `hud-stat` de Vidas para los juegos que no las usan. Sería más limpio, pero toca el HUD compartido por los ocho juegos para arreglar un guion.
- **Sí:** conservar la autorrepetición del teclado en movimiento y soft drop. Es lo que da el desplazamiento continuo; Asteroides la bloquea porque allí sobra, aquí es jugabilidad.
- **Sí:** bloquear la autorrepetición en rotación y en `Espacio` con `e.repeat`. Es una desviación consciente del original, donde mantener `Espacio` suelta una pieza por evento y vacía la mano sin querer.
- **Sí:** ignorar `Espacio` hasta soltarlo al entrar en `gameover`. Sin esto, morir mientras se sueltan piezas reinicia la partida antes de leer la puntuación.
- **Sí:** conservar el bucle por acumulador de milisegundos del original. Ya es independiente del frame rate; convertirlo a píxeles por segundo no aporta nada y arriesga la curva de velocidad.
- **Sí:** `endGame()` solo cambia `status`. En el original cancelaba el `requestAnimationFrame` y lo relanzaba desde `togglePause()`; con el contrato de la plataforma el bucle es único y solo lo detiene `destroy()`.

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| Al no unificar contratos, el union de estados y las firmas de `EngineOptions` / `GameController` quedan duplicados por juego, y con cuatro juegos pueden divergir sin que nadie lo note. | Consecuencia aceptada de la decisión. `PlayedSnapshot` es la red: cualquier juego cuyo snapshot deje de encajar falla al registrarse, en compilación y no en tiempo de ejecución. Si la duplicación llegara a molestar, unificar es un spec de refactor propio. |
| El paso 2 refactoriza la página que hoy monta Asteroides: es fácil romper el juego que ya funcionaba sin darse cuenta. | El paso 2 no toca ningún archivo de Asteroides —hay criterio de aceptación sobre el diff— y se verifica jugando antes de empezar Caída. |
| El original cancela y relanza el `requestAnimationFrame` desde `endGame()` y `togglePause()`. Copiarlo tal cual deja bucles huérfanos o duplicados, y `destroy()` deja de ser suficiente. | El paso 6 reduce `endGame()` a cambiar `status`, y el paso 8 concentra el ciclo de vida en el controller. Hay criterio de aceptación sobre salir de la ruta y sobre el doble montaje del Strict Mode. |
| `Espacio` hace tres cosas según el estado (arrancar, soltar pieza, reiniciar): un fallo aquí reinicia partidas por accidente. | Guardia de `e.repeat` más la regla de soltar la tecla al entrar en `ready` y `gameover`, con dos criterios de aceptación específicos. |
| Bloquear la autorrepetición en todas las teclas, como hace Asteroides, dejaría el movimiento lateral a una celda por pulsación y el juego injugable. | Está decidido por tecla y escrito en las convenciones: repetición sí en `←`, `→`, `↓`; no en rotación ni `Espacio`. Hay criterio de aceptación del desplazamiento continuo. |
| Desplazar el dibujo con `BOARD_X` es fácil de colar en la lógica: si el offset se cuela en `collide` o en `ghostY`, las colisiones se rompen de forma sutil. | El paso 5 porta la lógica en coordenadas de celda puras y el paso 7 aplica el desplazamiento solo al pintar. |
| Al reanudar tras una pausa larga, `dropAccum` acumulado hace bajar la pieza varias filas de golpe. | El paso 8 reinicia `dropAccum` al reanudar, además del capado de `dt` a 50 ms. Hay criterio de aceptación. |
| La pieza "tuerca" es hueca y no se puede rellenar: hace las líneas mucho más difíciles que en un Tetris estándar, y las puntuaciones de Caída no serán comparables con las de nadie que espere Tetris clásico. | Aceptado: es el juego que hay en `references/`. El texto `long` del catálogo se reescribe para avisar de que la pieza existe. |
| El `long` actual de `caida` describe un Tetris genérico; dejarlo mentiría por omisión, como pasó con los OVNIs de Asteroides. | Paso 3, con la reescritura del texto en el mismo commit que la migración. |
| `Partidas` de `/juegos/caida` pasa de "31.8K" a `1` en cuanto alguien termine una partida. | Es el comportamiento definido en el spec 06 y está en sus criterios de aceptación. No es un bug. |

## What is **not** in this spec

- El Top 5 local, la entrada de nombre y las mejores marcas de combo y líneas del original.
- Skins, tema claro/oscuro y selector de nivel inicial.
- Cambios en la escritura o la lectura de `scores`.
- Hold de pieza, SRS real, wall kicks completos o cualquier mejora de jugabilidad sobre el original.
- Sonido, controles táctiles y canvas responsive.
- Portar Arkanoid.
- Tests automatizados.

Cada uno de estos, si se implementa, va en su propio spec.
