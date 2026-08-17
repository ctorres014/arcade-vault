# Checklist de verificación de un juego nuevo

Derivada de los criterios de aceptación de los specs 05 y 06. No hay test runner:
esto se pasa a mano en el navegador, con `npm run dev`.

## Build

- [ ] `npm run lint` y `npm run build` pasan sin errores.
- [ ] No quedan restos del id antiguo si hubo renombrado (fuera de `references/`).

## Catálogo y rutas

- [ ] `/games` muestra la tarjeta del juego con su portada.
- [ ] `/juegos/<id>` carga la ficha, y el texto `long` describe el juego real.
- [ ] `/juegos/<id>/jugar` muestra el canvas dentro del marco CRT, no el
      `game-arena` decorativo.
- [ ] Un juego **no** jugable (ej. `/juegos/ranaria/jugar`) sigue mostrando el
      `game-arena` decorativo exactamente como antes.

## Ciclo de partida

- [ ] Al entrar, el juego **no** corre: se ve `PULSA ESPACIO PARA EMPEZAR` y nada
      se mueve.
- [ ] Espacio arranca la partida con los valores iniciales correctos.
- [ ] Los controles responden y la leyenda de teclas bajo el CRT los describe.
- [ ] Pulsar flechas o Espacio durante la partida **no** hace scroll de la página.
- [ ] Mantener Espacio pulsado no dispara/actúa una vez por frame.
- [ ] La puntuación por acción coincide con la del juego original.
- [ ] `P` muestra el overlay `PAUSA` y congela el juego; `P` de nuevo lo reanuda
      sin saltos de posición.
- [ ] Cambiar de pestaña pausa el juego; al volver sigue en pausa hasta pulsar `P`.
- [ ] Perder la última vida muestra `GAME OVER` **dentro del canvas** con la
      puntuación final, y Espacio reinicia desde cero.
- [ ] El canvas se ve completo y sin deformarse al estrechar la ventana (4:3).

## HUD

- [ ] Puntuación, vidas y nivel se actualizan en tiempo real.
- [ ] **No** hay score, nivel ni iconos de vida dibujados dentro del canvas.
- [ ] Muestra el `username` real con sesión y `INVITADO` sin ella, y se puede
      jugar la partida completa en ambos casos.

## Limpieza (las trampas caras)

- [ ] Salir con SALIR o VOLVER AL VAULT detiene el bucle: no quedan
      `requestAnimationFrame` activos ni listeners, y las flechas no producen
      efectos en otra página.
- [ ] En dev (Strict Mode, doble montaje) el juego **no** va al doble de
      velocidad ni responde dos veces a una tecla.
- [ ] El profiler de React no muestra renders continuos de la página mientras se
      juega: el snapshot solo se emite cuando cambia.

## Leaderboard

- [ ] `public.games` tiene la fila del juego con `playable = true`, y la
      migración está commiteada.
- [ ] Con sesión real, terminar una partida crea **exactamente una** fila en
      `scores`, con el score final, el nivel alcanzado, la duración en segundos y
      el `user_id` de la sesión (verificar con `execute_sql`).
- [ ] Reiniciar con Espacio y volver a morir crea una **segunda** fila
      independiente.
- [ ] Como invitado o sin sesión no se crea ninguna fila y no hay errores en
      consola.
- [ ] Salir antes del Game Over no crea ninguna fila.
- [ ] Cortando la red en las devtools aparece `NO SE PUDO GUARDAR` en el HUD y el
      juego se sigue pudiendo reiniciar con Espacio.
- [ ] En `/juegos/<id>` la marca real encabeza la tabla, el relleno `CPU` va
      debajo atenuado, y los rangos van del 01 al 10 sin saltos.
- [ ] `Partidas` y `Mejor global` de la ficha reflejan los valores reales; un
      juego sin partidas sigue mostrando los decorativos de `lib/games.ts`.
- [ ] La pestaña del juego en `/salon-de-la-fama` muestra sus 12 filas con el
      podio completo, y "TU MEJOR MARCA" aparece solo con sesión y partidas.
- [ ] El ranking de la portada incluye la marca real si es de las 5 mejores.
- [ ] `get_advisors` no reporta advertencias de seguridad nuevas.
