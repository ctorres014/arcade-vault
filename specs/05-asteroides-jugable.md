# SPEC 05 — Asteroides jugable en la plataforma

> **Status:** Aprobado
> **Depends on:** 01-mvp-visual, 02-home-page
> **Date:** 2026-07-27
> **Objective:** Portar el juego Asteroids de `references/started-games/02-asteroids` a un motor de canvas reutilizable en `lib/games/asteroides/` y montarlo en `/juegos/asteroides/jugar`, con el HUD de la plataforma alimentado por el estado del motor.

## Scope

**In:**

- Renombrado del juego `rocas` → `asteroides` en `lib/games.ts`: `id: "asteroides"`, `title: "ASTEROIDES"`, `cover: "cover-asteroides"`, y el texto `long` reescrito para que describa el juego real (sin OVNIs, que no existen; con power-up de disparo triple, que sí). Las clases `.cover-rocas` de `app/globals.css` se renombran a `.cover-asteroides`.
- Motor de juego puro en `lib/games/asteroides/engine.ts`: puerto de las 510 líneas de `game.js` sin globals ni React. Exporta una función que recibe el `HTMLCanvasElement` y opciones, y devuelve un controlador con `start()`, `pause()`, `resume()`, `restart()` y `destroy()`.
- Tipos del motor en `lib/games/asteroides/types.ts`: el snapshot de estado que consume el HUD.
- Componente cliente `components/games/asteroides.tsx`: monta el canvas 800×600, arranca el motor, recibe los snapshots y renderiza el HUD y la leyenda de controles.
- Integración en `app/juegos/[id]/jugar/page.tsx`: cuando `id === "asteroides"` se renderiza el juego dentro del `crt-screen`; para los otros siete juegos sigue apareciendo el `game-arena` decorativo de siempre.
- HUD de React alimentado por el motor: **Jugador** (username real o `INVITADO`), **Puntuación**, **Vidas**, **Nivel** y un `hud-stat` de **3x** que solo aparece mientras el disparo triple está activo. Se elimina `drawHUD()` del canvas para no duplicar la información.
- Pantalla de inicio dentro del canvas: `PULSA ESPACIO PARA EMPEZAR`. El juego no corre hasta que el jugador lo arranca.
- `GAME OVER` con la puntuación final y `ESPACIO PARA REINICIAR` **dentro del canvas**, como en el original.
- Pausa con `P`, con overlay `PAUSA` en el canvas, y auto-pausa cuando la pestaña deja de ser visible (`visibilitychange`).
- Captura de teclado en `window` con `preventDefault()` en `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight` y `Space`, para que la página no haga scroll mientras se juega.
- Limpieza al desmontar: se cancela el `requestAnimationFrame` y se quitan todos los listeners.
- Leyenda de controles fija debajo del marco CRT: `← → ROTAR · ↑ PROPULSAR · ESPACIO DISPARAR · P PAUSA`.
- Canvas interno fijo a 800×600, escalado por CSS con `width: 100%` y `aspect-ratio: 4 / 3`. La física del motor no cambia.
- Se conservan tal cual del juego original: espacio toroidal, tres tamaños de asteroide (20/50/100 puntos), división al destruirlos, partículas de explosión, 3 vidas con invencibilidad parpadeante de 3 s, niveles infinitos con `3 + level` asteroides y el power-up de disparo triple (uno por nivel, 15 % de probabilidad o garantizado a los 5 asteroides destruidos, 5 s de duración).

**Out of scope (for future specs):**

- Persistencia de puntuaciones y Salón de la Fama con datos reales. Al salir de la partida, la puntuación se pierde.
- Cualquier escritura en Supabase. Este spec no toca la base de datos.
- Requerir sesión para jugar: cualquiera juega, con cuenta, como invitado o sin nada.
- Controles táctiles y jugabilidad en móvil. El canvas escala, pero sin teclado no se juega.
- Sonido y música. El juego original no tiene y aquí no se añade.
- Portar los otros juegos del catálogo (Tetris y Arkanoid ya están en `references/started-games/`). Cada uno en su propio spec, reutilizando el patrón que establece este.
- Canvas responsive de verdad (recalcular `W`/`H` al redimensionar).
- Dificultad ajustable, tabla de récords local, OVNIs u otros enemigos nuevos.
- Tests automatizados: no hay test runner en el repo.

## Data model

`lib/games/asteroides/types.ts` — el contrato entre el motor y React:

```ts
export type GameStatus = "ready" | "playing" | "dead" | "paused" | "gameover";

// Lo único que el motor expone a React. No incluye posiciones ni entidades.
export type GameSnapshot = {
  status: GameStatus;
  score: number;
  lives: number;
  level: number;
  tripleShotLeft: number; // segundos restantes, 0 si no está activo
};

export type EngineOptions = {
  onState: (snapshot: GameSnapshot) => void;
};

export type GameController = {
  start: () => void;
  pause: () => void;
  resume: () => void;
  restart: () => void;
  destroy: () => void;
};
```

`lib/games/asteroides/engine.ts` expone una única función:

```ts
export function createAsteroidesGame(
  canvas: HTMLCanvasElement,
  options: EngineOptions
): GameController;
```

Estado interno del motor (privado, nunca sale del módulo): `ship`, `bullets`, `asteroids`, `particles`, `powerUps`, `deadTimer`, `killsSinceSpawn`, `powerUpSpawned`, más las clases `Ship`, `Bullet`, `Asteroid`, `Particle` y `PowerUp` portadas del original.

Convenciones:

- Coordenadas con origen arriba-izquierda. Canvas fijo `W = 800`, `H = 600`.
- Velocidades en píxeles por **segundo** (el motor es delta-time, no por frame). `dt` capado a 50 ms.
- Constantes intactas respecto al original: `RADII = [0, 16, 30, 50]`, `SPEEDS = [0, 85, 55, 32]`, `POINTS = [0, 100, 50, 20]`, `POWERUP_DROP_CHANCE = 0.15`, `POWERUP_DURATION = 5`, `POWERUP_TTL = 12`, `TRIPLE_SPREAD = 0.18`.
- `status` amplía los tres estados del original (`playing` / `dead` / `gameover`) con `ready` (pantalla de inicio) y `paused`.
- **`onState` solo se invoca cuando el snapshot cambia respecto al anterior**, no en cada frame. `tripleShotLeft` se compara redondeado a un decimal, que es la precisión que muestra el HUD; si no, cambiaría 60 veces por segundo.

Cambio en `lib/games.ts` (entrada existente, no se añade ninguna):

```ts
{
  id: "asteroides",
  title: "ASTEROIDES",
  cat: "SHOOTER",
  cover: "cover-asteroides",
  color: "yellow",
  // short y long reescritos; best y plays se mantienen como están (son decorativos).
}
```

## Implementation plan

1. Renombrar en `lib/games.ts` la entrada `rocas` → `asteroides` (`id`, `title`, `cover`) y reescribir `short` y `long` para que describan el juego real. Renombrar `.cover-rocas` → `.cover-asteroides` en `app/globals.css` (tres reglas: base, `::after` y `::before`). Test: el catálogo en `/games` muestra "ASTEROIDES" con su portada intacta, y `/juegos/asteroides` carga la ficha.
2. Crear `lib/games/asteroides/types.ts` con `GameStatus`, `GameSnapshot`, `EngineOptions` y `GameController`. Nadie lo usa todavía. Test: `npm run lint` y `npm run build` pasan.
3. Crear `lib/games/asteroides/engine.ts` con el esqueleto de `createAsteroidesGame`: obtiene el contexto 2D, pinta el fondo negro y devuelve un `GameController` con los cinco métodos vacíos. Test: importarlo no rompe el build.
4. Portar al motor las clases `Bullet`, `Asteroid`, `Particle` y `PowerUp` con tipos explícitos, recibiendo `ctx` como parámetro en `draw()` en vez de leer un global. Sin bucle todavía.
5. Portar la clase `Ship`, incluyendo el dibujo de la silueta y la llama del propulsor. El estado de teclas se lee de un objeto interno del motor, no de un global de módulo.
6. Portar el estado de partida y sus funciones: `initGame`, `spawnAsteroids`, `nextLevel`, `explode`, `killShip`, `update(dt)` y `draw()`. `draw()` **no** incluye `drawHUD()`. Test manual: montando el motor a mano en la ruta, la nave se mueve, dispara y los asteroides se parten.
7. Implementar en el motor el bucle y el ciclo de vida: `start`, `pause`, `resume`, `restart`, `destroy`, los listeners de teclado en `window` con `preventDefault` en flechas y `Space`, el listener de `visibilitychange` que auto-pausa, y la tecla `P`. `destroy()` cancela el `requestAnimationFrame` y quita todos los listeners.
8. Implementar en el motor la emisión de snapshots: función interna que compone el `GameSnapshot`, lo compara con el anterior (con `tripleShotLeft` redondeado a un decimal) y llama a `onState` solo si difiere.
9. Añadir al motor los overlays de canvas: `PULSA ESPACIO PARA EMPEZAR` en `ready`, `PAUSA` en `paused` y `GAME OVER` con puntuación final y `ESPACIO PARA REINICIAR` en `gameover`. `Space` arranca desde `ready` y reinicia desde `gameover`.
10. Crear `components/games/asteroides.tsx` (Client Component): `useRef` al canvas, `useEffect` que crea el motor y lo destruye al desmontar, `useState` con el último snapshot, y render del `<canvas width={800} height={600}>` más la leyenda de controles. Test manual: el juego es jugable en una página de prueba.
11. Conectar `app/juegos/[id]/jugar/page.tsx`: si `id === "asteroides"`, renderizar `<Asteroides />` dentro del `crt-screen` en lugar del `game-arena`; el resto de juegos no cambian. El HUD superior pasa a leer del snapshot: puntuación, vidas (♥ repetido según `lives`) y nivel con dos dígitos.
12. Añadir el `hud-stat` de **3x**, visible solo cuando `tripleShotLeft > 0`, mostrando los segundos con un decimal. Añadir a `app/globals.css` los estilos del canvas escalado (`width: 100%`, `aspect-ratio: 4 / 3`, `image-rendering` acorde al resto del CRT) y de la leyenda de controles. Verificar que `npm run lint` y `npm run build` pasan.

## Acceptance criteria

- [ ] `npm run build` y `npm run lint` pasan sin errores.
- [ ] No queda ninguna aparición de `rocas` ni `ROCAS` fuera de `references/`.
- [ ] `/games` muestra la tarjeta "ASTEROIDES" con la misma portada de antes y `/juegos/asteroides` carga su ficha.
- [ ] `/juegos/asteroides/jugar` muestra el canvas del juego dentro del marco CRT, no el `game-arena` decorativo.
- [ ] `/juegos/caida/jugar` (y el resto de ids) sigue mostrando el `game-arena` decorativo exactamente como antes.
- [ ] Al entrar en `/juegos/asteroides/jugar` el juego **no** está corriendo: se ve `PULSA ESPACIO PARA EMPEZAR` y los asteroides no se mueven.
- [ ] Pulsar `Espacio` en la pantalla de inicio arranca la partida con 3 vidas, nivel 1 y 4 asteroides grandes.
- [ ] `←` y `→` rotan la nave, `↑` la propulsa con llama visible y `Espacio` dispara con la cadencia de 0,2 s.
- [ ] Pulsar flechas o `Espacio` durante la partida **no** hace scroll de la página.
- [ ] Destruir un asteroide grande suma 20 puntos y lo parte en dos medianos; un mediano suma 50 y da dos pequeños; un pequeño suma 100 y no se parte.
- [ ] El HUD de React refleja puntuación, vidas y nivel en tiempo real, y **no** hay ningún texto de score, nivel ni iconos de vida dibujados dentro del canvas.
- [ ] Recoger el power-up activa el disparo triple, aparece el `hud-stat` **3x** con la cuenta atrás y desaparece a los 5 segundos.
- [ ] Chocar con un asteroide resta una vida, explota en partículas y la nave reaparece a los 2 segundos parpadeando e invulnerable.
- [ ] Al destruir el último asteroide se pasa de nivel: el contador sube, la nave se recoloca en el centro y aparecen `3 + nivel` asteroides.
- [ ] Perder la tercera vida muestra `GAME OVER` **dentro del canvas** con la puntuación final, y `Espacio` reinicia la partida desde cero.
- [ ] Pulsar `P` durante la partida muestra el overlay `PAUSA` y congela el juego; pulsar `P` de nuevo lo reanuda sin saltos de posición.
- [ ] Cambiar a otra pestaña pausa el juego automáticamente; al volver sigue en pausa hasta que se pulse `P`.
- [ ] Salir de la ruta (botón SALIR o VOLVER AL VAULT) detiene el bucle: no quedan `requestAnimationFrame` activos ni listeners de teclado, y pulsar flechas en otra página no produce efectos.
- [ ] La leyenda `← → ROTAR · ↑ PROPULSAR · ESPACIO DISPARAR · P PAUSA` es visible debajo del marco CRT.
- [ ] El canvas se ve completo y sin deformarse al estrechar la ventana, manteniendo la proporción 4:3.
- [ ] El HUD muestra el `username` real con sesión iniciada e `INVITADO` sin ella, y se puede jugar la partida completa en ambos casos.
- [ ] Jugar una partida no produce ninguna petición a Supabase ni escribe nada en la base de datos.

## Decisiones

- **Sí:** motor puro en `lib/games/asteroides/engine.ts`, separado del componente React. Decisión del usuario. Cuesta más archivos, pero el HUD de la plataforma puede leer el estado sin trucos y los siguientes juegos copian el patrón.
- **No:** toda la lógica dentro de `components/games/asteroides.tsx` con un `useEffect` gigante. Más rápido de escribir, imposible de reutilizar y mezcla dos responsabilidades.
- **No:** `<iframe>` al juego original servido desde `public/`. Es el port más barato, pero deja el juego aislado de la plataforma: el HUD nunca se enteraría del score.
- **Sí:** `onState` solo cuando el snapshot cambia, con `tripleShotLeft` redondeado a un decimal. Decisión del usuario. Evita 60 `setState` por segundo, que es el error clásico al meter un canvas en React.
- **No:** `onState` en cada frame, ni polling con `setInterval`. El primero rinde mal, el segundo desincroniza el HUD del juego.
- **Sí:** HUD de vidas, score y nivel en React; `drawHUD()` se elimina del motor. Decisión del usuario. La información no se duplica y el HUD usa los estilos de la plataforma (`hud-stat`).
- **Sí:** los overlays de `GAME OVER`, `PAUSA` y arranque se quedan **dentro del canvas**. Decisión del usuario. Van pegados al bucle del juego y no requieren sincronizar un estado extra con React.
- **Sí:** pantalla `PULSA ESPACIO PARA EMPEZAR`. El original arranca solo; aquí el jugador entra desde una ficha y conviene que el juego no corra mientras lee.
- **Sí:** canvas interno fijo a 800×600 escalado por CSS. Decisión del usuario. Toda la física del original asume esas dimensiones; recalcularlas abriría bugs en el wrap, el spawn y las colisiones a cambio de poca ganancia.
- **No:** canvas responsive recalculando `W`/`H`. Se ve mejor en pantallas grandes; queda para un spec futuro si alguien lo pide.
- **Sí:** pausa con `P` y auto-pausa al ocultar la pestaña. Decisión del usuario. El `dt` capado a 50 ms evita el salto brusco, pero volver y encontrarse la nave a la deriva es peor experiencia que volver en pausa.
- **Sí:** `preventDefault` en flechas y `Space`, con listeners en `window`. Sin ello la página hace scroll con cada disparo. En `window` y no en el canvas porque el canvas no es focusable por defecto y obligaría a añadir `tabIndex`.
- **Sí:** renombrar la entrada `rocas` a `asteroides` en vez de crear una nueva. Decisión del usuario. El catálogo se queda en 8 juegos y no hay dos entradas para el mismo juego.
- **Sí:** reescribir el texto `long` del juego. El actual promete OVNIs que no existen y omite el power-up de disparo triple que sí está.
- **Sí:** sin restricción de sesión para jugar. Decisión del usuario. Como no se guardan puntuaciones, exigir cuenta no aporta nada.
- **No:** guardar la puntuación en Supabase. Decisión del usuario. Necesita tabla nueva, RLS, decidir qué pasa con el invitado y algún control anti-trampas; es un spec entero.
- **No:** sonido. El original no tiene y añadirlo obligaría a buscar assets y a resolver el autoplay bloqueado del navegador.
- **No:** controles táctiles. Decisión del usuario. El juego es de teclado y hacerlo jugable con el dedo es rediseñar los controles, no portarlos.
- **Sí:** delta-time tal como está en el original, en píxeles por segundo. Es más robusto que el bucle por frame del Arkanoid de referencia y no hay motivo para tocarlo.

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| Meter un bucle de canvas en React y llamar a `setState` en cada frame degrada el rendimiento hasta hacer el juego injugable. | `onState` solo emite cuando el snapshot cambia, y `tripleShotLeft` se compara redondeado a un decimal. Hay criterio de aceptación sobre el HUD en tiempo real. |
| El `useEffect` se ejecuta dos veces en desarrollo (Strict Mode) y quedan dos bucles y dos juegos de listeners corriendo a la vez: la nave se movería al doble de velocidad. | `destroy()` cancela el `requestAnimationFrame` y quita todos los listeners, y el `useEffect` lo llama en su función de limpieza. Un criterio de aceptación verifica que al salir de la ruta no queda nada activo. |
| Los listeners de teclado viven en `window`: si no se limpian al desmontar, las flechas siguen capturadas en el resto de la app. | Mismo `destroy()`, con criterio de aceptación específico de pulsar flechas en otra página. |
| El motor toca `window`, `document` y `performance` en un proyecto con App Router: importarlo desde un Server Component rompería el render. | El motor solo se importa desde `components/games/asteroides.tsx`, que es `"use client"`, y todo acceso al DOM ocurre dentro del `useEffect`. |
| Portar 510 líneas de JS a TypeScript introduce errores silenciosos de tipos en las constantes indexadas por tamaño (`RADII`, `SPEEDS`, `POINTS`, índices 1–3 con el 0 sin usar). | Los pasos 4 a 6 portan por clases, con prueba manual tras el paso 6. Los valores de puntuación tienen criterio de aceptación explícito (20/50/100). |
| Renombrar `rocas` deja referencias sueltas y una portada rota en el catálogo. | El paso 1 renombra id, title, cover y las tres reglas CSS a la vez, y hay un criterio de aceptación que exige cero apariciones de `rocas` fuera de `references/`. |
| El canvas escalado por CSS se ve borroso o pixelado dentro del marco CRT, que ya aplica sus propios efectos. | El escalado mantiene la proporción 4:3 y el paso 12 ajusta `image-rendering` en línea con el resto del CRT. |

## What is **not** in this spec

- Persistencia de puntuaciones y Salón de la Fama con datos reales.
- Cualquier escritura en Supabase.
- Requerir sesión para jugar.
- Controles táctiles y jugabilidad en móvil.
- Sonido y música.
- Portar Tetris o Arkanoid desde `references/started-games/`.
- Canvas responsive recalculando dimensiones.
- Dificultad ajustable, récords locales o enemigos nuevos.
- Tests automatizados.

Cada uno de estos, si se implementa, va en su propio spec.
