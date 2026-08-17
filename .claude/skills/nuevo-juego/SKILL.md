---
name: nuevo-juego
description: Añade un juego jugable a Arcade Vault con su leaderboard real. Úsalo cuando se pida portar un juego de references/started-games (Tetris, Arkanoid, ...), montar un juego nuevo en /juegos/[id]/jugar, o conectar la puntuación de una partida a Supabase. Aplica el patrón fijado por los specs 05 (motor + HUD) y 06 (scores + relleno CPU).
argument-hint: <id-del-juego> [carpeta de references/started-games]
---

# /nuevo-juego — Portar un juego a la plataforma

Este skill codifica el patrón que ya está implementado y aprobado en el repo:
`specs/05-asteroides-jugable.md` (motor de canvas + HUD de React) y
`specs/06-leaderboard-y-tabla-de-juegos.md` (persistencia en `scores` + fusión con
relleno). **Asteroides es la referencia viva**: ante cualquier duda, mira cómo lo
hace `lib/games/asteroides/` y copia, no inventes.

## Antes de empezar

- Este repo trabaja **spec-driven**. Si el usuario no viene ya de un `/spec`
  aprobado, propón escribir primero el spec del juego con `/spec` usando las
  fases de abajo como esqueleto del *implementation plan*, y luego implementarlo
  con `/spec-impl`. Solo salta este paso si el usuario dice explícitamente que
  quiere ir directo al código.
- Next.js 16.2.10 / React 19.2.4: consulta `node_modules/next/dist/docs/01-app/`
  antes de tocar routing o data fetching. No tires de memoria.
- No hay test runner. La verificación es `npm run lint`, `npm run build` y prueba
  manual en el navegador.

## Fase 0 — Identificar el juego y su origen

Del argumento `$ARGUMENTS` saca el `id` (slug en kebab-case, en español, el mismo
que usará la URL `/juegos/<id>/jugar`).

1. **¿El id ya existe en `lib/games.ts`?**
   - Sí → se reutiliza la entrada. Reescribe `short`/`long` si prometen cosas que
     el juego real no tiene (pasó con Asteroides: prometía OVNIs inexistentes).
   - No → hay que añadir entrada al catálogo **y** fila a `public.games` con una
     migración nueva. Ver `references/integracion-plataforma.md`.
   - Si hay que **renombrar** un id (como `rocas` → `asteroides`), el renombrado
     toca a la vez: `lib/games.ts`, las clases `.cover-*` de `app/globals.css` y
     una migración que arregle `public.games`, porque `scores.game_id` tiene FK.

2. **¿De dónde viene el código?**
   - De `references/started-games/` (`03-claude-tetris`, `04-arkanoid`): son
     juegos vanilla de un solo `game.js` con estado en globals de módulo y
     `index.html`. Lee su `CLAUDE.md`, que describe la arquitectura de cada uno.
     El trabajo es **portar**, no rediseñar: constantes, física y puntuaciones se
     conservan intactas salvo que el usuario pida otra cosa.
   - De cero: mismo contrato, pero el diseño de la jugabilidad se acuerda antes
     en el spec.

3. **Ojo con el bucle**: Asteroides es delta-time (px/segundo, `dt` capado a
   50 ms) y Arkanoid es por frame. Si el original es por frame, decide con el
   usuario si se porta tal cual o se convierte a delta-time; delta-time es lo
   preferido en la plataforma por la auto-pausa al ocultar la pestaña.

## Fase 1 — El motor (`lib/games/<id>/`)

Dos archivos, cero React, cero Supabase, cero globals de módulo mutables.

- `types.ts`: `GameStatus`, `GameSnapshot`, `EngineOptions`, `GameController`.
- `engine.ts`: `export function create<Juego>Game(canvas, options): GameController`.

Las reglas duras del contrato (estados obligatorios, emisión de snapshots,
`destroy()`, `preventDefault`, overlays dentro del canvas) están en
**`references/contrato-motor.md`**. Léelo antes de escribir la primera línea del
motor: son las que hacen que el HUD y el guardado funcionen sin tocarse.

Orden de trabajo recomendado (el que siguió el spec 05, probado):
esqueleto del controller → entidades/clases con `draw(ctx)` → estado de partida y
`update(dt)`/`draw()` → bucle y ciclo de vida → `emitState()` → overlays.

## Fase 2 — El componente (`components/games/<id>.tsx`)

`"use client"`. Copia la forma exacta de `components/games/asteroides.tsx`:
canvas 800×600 con `className="game-canvas"`, `useEffect` sin dependencias que
crea el motor y devuelve `game.destroy()`, `onSnapshot` leído desde un ref, y un
export `<Juego>Controls` con la leyenda de teclas.

El componente **no sabe que Supabase existe**. Esa es la razón de que el guardado
viva en la página.

## Fase 3 — Montarlo en la ruta

`app/juegos/[id]/jugar/page.tsx` hoy decide con `game.id === "asteroides"`.

**Al añadir el segundo juego, eso deja de valer.** Sustitúyelo por un registro:

```ts
// lib/games/registry.ts
export const PLAYABLE: Record<string, { Game: ..., Controls: ... }> = { ... };
```

y en la página `const entry = PLAYABLE[id]`, renderizando el `game-arena`
decorativo cuando no hay entrada. Los otros juegos del catálogo tienen que seguir
viéndose exactamente igual que antes.

El HUD superior de la página es común a todos los juegos: Jugador, Puntuación,
Vidas, Nivel. Si tu juego tiene un extra (el `3x` de Asteroides), va como
`hud-stat` condicional, nunca dibujado dentro del canvas.

## Fase 4 — Leaderboard

La escritura ya está implementada de forma genérica en la página: detecta la
transición a `status: "gameover"`, mide la duración y hace el `insert` en
`scores` solo si `user.kind === "supabase"`. **Si tu juego cumple el contrato de
snapshot, no hay que tocar nada de esto.**

Lo que sí puede hacer falta:

- Migración `supabase/migrations/000N_*.sql` si el `id` no está en `public.games`,
  y `update public.games set playable = true where id = '<id>'`.
- `level` y `duration_seconds` son `not null`. Un juego sin niveles inserta `1`.
  Un juego sin vidas emite `lives: 0` y el HUD pinta `—`.
- Lectura: no toques `lib/scores.ts` salvo que necesites una consulta nueva. Las
  tres pantallas (ficha, Salón, home) ya leen por `game_id` y funcionan solas en
  cuanto hay filas.

Detalles y semillas del relleno: **`references/integracion-plataforma.md`**.

## Fase 5 — Verificación

Ejecuta `npm run lint` y `npm run build`, y recorre a mano la checklist de
`references/checklist.md`. No des el juego por terminado sin haberla pasado:
está escrita a partir de los criterios de aceptación de los specs 05 y 06, e
incluye las trampas reales (doble montaje del Strict Mode, listeners huérfanos en
`window`, filas duplicadas en `scores`).

## Lo que este skill NO hace

Sin pedirlo explícitamente el usuario, no añadas: sonido, controles táctiles,
canvas responsive recalculando dimensiones, dificultad ajustable, validación
anti-trampas en servidor, Realtime, ni puntuaciones de invitados. Todo eso está
declarado fuera de alcance en los specs 05 y 06; si hace falta, va en su spec.
