# Contrato del motor de juego

Referencia viva: `lib/games/asteroides/types.ts` y `lib/games/asteroides/engine.ts`.

## `lib/games/<id>/types.ts`

```ts
export type GameStatus = "ready" | "playing" | "dead" | "paused" | "gameover";

export type GameSnapshot = {
  status: GameStatus;
  score: number;
  lives: number;   // 0 si el juego no tiene vidas; el HUD pinta "—"
  level: number;   // 1 si el juego no tiene niveles (la columna es not null)
  // extras opcionales del juego, ej. tripleShotLeft en Asteroides
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

**Los cinco estados son obligatorios**, aunque tu juego no los use todos:

- `ready` — partida montada y congelada, overlay `PULSA ESPACIO PARA EMPEZAR`.
  El juego no corre mientras el jugador lee la ficha.
- `playing` — en marcha.
- `dead` — vida perdida, pausa breve antes de reaparecer. Si tu juego no tiene
  vidas, simplemente nunca entres en este estado.
- `paused` — `P` y auto-pausa por `visibilitychange`.
- `gameover` — **es el estado del que depende el guardado en Supabase.** Si tu
  motor no emite `gameover`, no se guarda ninguna puntuación.

La página distingue "empieza una partida" por la transición a `playing` desde
`ready` **o desde `gameover`** (el reinicio con Espacio se salta `ready`). Volver
de `dead` o de `paused` es la misma partida y no reinicia el cronómetro. Si tu
motor reinicia de otra forma, avísalo: hay que ajustar la página.

## `lib/games/<id>/engine.ts`

```ts
export function create<Juego>Game(
  canvas: HTMLCanvasElement,
  options: EngineOptions
): GameController;
```

Reglas duras, todas con motivo:

1. **Todo el estado vive dentro de la función**, no en el módulo. Dos motores
   simultáneos (Strict Mode monta el efecto dos veces) no deben pisarse.
2. **Nada de `drawHUD()`.** El score, las vidas y el nivel los pinta React con
   los estilos de la plataforma. Dentro del canvas solo van los overlays de
   `ready`, `paused` y `GAME OVER` (con la puntuación final y
   `ESPACIO PARA REINICIAR`).
3. **`onState` solo cuando el snapshot cambia**, comparando campo a campo contra
   el anterior. Los valores continuos se redondean a la precisión que muestra el
   HUD antes de comparar (`tripleShotLeft` a un decimal). Sin esto son 60
   `setState` por segundo y el juego se vuelve injugable.
4. **`destroy()` cancela el `requestAnimationFrame` y quita todos los
   listeners**, y es idempotente. Los listeners de teclado están en `window`
   (el canvas no es focusable sin `tabIndex`), así que si no se limpian, las
   flechas quedan capturadas en el resto de la app.
5. **`preventDefault()`** en `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight` y
   `Space`, o la página hace scroll con cada disparo. Ignora la autorrepetición
   del teclado (`if (keys[e.code]) return`) y usa un `justPressed` que se
   consume, para que mantener Espacio no dispare cada frame.
6. **Canvas interno fijo a 800×600**, escalado por CSS (`.game-canvas` ya tiene
   `width: 100%` y `aspect-ratio: 4 / 3`). La física asume esas dimensiones;
   recalcularlas abre bugs en wrap, spawn y colisiones.
7. **Delta-time en píxeles por segundo**, con `dt` capado a 50 ms. Evita la
   espiral de la muerte al volver de una pestaña oculta.
8. En `ready` y `paused` el mundo se congela pero **se sigue pintando**, para que
   el overlay se vea.
9. El motor solo se importa desde el componente `"use client"`, y todo acceso a
   `window`/`document`/`performance` ocurre dentro del `useEffect`. Importarlo
   desde un Server Component rompe el render.

Al final de la construcción, antes de devolver el controller: `initGame()`,
`status = "ready"`, `draw()`, `emitState()`. Así la primera pintada ya muestra el
campo de juego congelado con su overlay.

## `components/games/<id>.tsx`

Calca `components/games/asteroides.tsx`:

- `"use client"`.
- `useRef` al canvas; `useEffect` **sin dependencias** que crea el motor, llama a
  `start()` y devuelve `() => game.destroy()`.
- La prop `onSnapshot` se guarda en un ref y se lee desde ahí dentro del
  callback del motor: si entrara en las dependencias del efecto, cada render del
  padre recrearía el juego.
- `<canvas width={800} height={600} className="game-canvas" aria-label="<Juego>" />`.
- Export aparte con la leyenda de controles (`className="game-controls"`), que la
  página coloca **debajo** del marco CRT, fuera de la pantalla.
