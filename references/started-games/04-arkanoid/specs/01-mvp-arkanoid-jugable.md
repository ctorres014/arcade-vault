# Spec 01 — MVP Arkanoid Jugable

**Estado:** Aprovado
**Dependencias:** Ninguna (primer spec del proyecto)
**Fecha:** 2026-07-05

**Objetivo:** Crear un Arkanoid mínimo pero completamente jugable en el navegador (HTML/Canvas de 800x600px/JS), con una paleta controlada por teclado, una pelota que rebota, un único nivel de 10x5 bloques, sistema de 3 vidas, y mensajes simples de victoria/derrota con reinicio por tecla.

## Alcance

**Incluido:**
- Canvas HTML de 800x600px como área de juego completa.
- Paleta controlada con flechas de teclado (← / →), movimiento horizontal, limitada a los bordes del canvas.
- Una pelota que rebota contra paredes (arriba, izquierda, derecha), la paleta y los bloques.
- Un único nivel con grilla fija de bloques: 10 columnas x 5 filas, usando los sprites de colores de `assets/spritesheet-breakout.png` vía `assets/spritesheet.js`.
- Sistema de 3 vidas: se pierde una vida cuando la pelota cae por debajo de la paleta; la pelota y la paleta se reinician a posición inicial tras perder una vida (mientras queden vidas).
- Condición de derrota: al perder la tercera vida, se muestra un mensaje simple en el canvas ("Perdiste") y se indica una tecla para reiniciar la partida completa.
- Condición de victoria: al destruir los 50 bloques, se muestra un mensaje simple en el canvas ("Ganaste") y se indica una tecla para reiniciar la partida completa.
- Reinicio de partida completo (nivel, vidas, score si existiera) mediante una tecla (ej. R), disponible únicamente en pantalla de victoria/derrota.
- Un solo archivo `index.html` y un solo archivo `game.js`.

**No incluido (fuera de alcance para este MVP):**
- Power-ups de cualquier tipo (paddle grande, multi-ball, etc.) — spec futuro.
- Sonido/audio (`ball-bounce.mp3`, `break-sound.mp3` quedan sin usar por ahora) — spec futuro.
- Múltiples niveles o progresión de niveles — spec futuro.
- Persistencia de cualquier tipo (high scores, estado guardado) — spec futuro.
- Soporte de mouse/touch para controlar la paleta.
- Sistema de puntaje visible (score) — no se pidió, se deja fuera salvo que se indique lo contrario.
- Pantallas de menú/inicio, pausa, o UI adicional más allá del mensaje simple de victoria/derrota.

## Modelo de datos

No hay persistencia entre sesiones, por lo que no se define un modelo de datos guardado. El estado del juego vive en memoria mientras la página está abierta, con estructuras simples en `game.js`:

- **`paddle`**: `{ x, y, width, height, speed }` — posición y tamaño de la paleta, tomados del sprite correspondiente en `spritesheet.js`.
- **`ball`**: `{ x, y, radius, dx, dy }` — posición y velocidad (delta x/y) de la pelota.
- **`blocks`**: arreglo de 50 objetos `{ x, y, width, height, color, destroyed }` — uno por cada celda de la grilla 10x5, generado al iniciar/reiniciar el nivel.
- **`lives`**: número entero, inicia en 3, decrementa al perder la pelota.
- **`gameState`**: string/enum simple (`"playing"`, `"won"`, `"lost"`) — controla qué se dibuja y si se escucha la tecla de reinicio.

Todas estas estructuras se recrean desde cero al reiniciar (tecla R en pantalla de victoria/derrota).

## Plan de implementación

1. **Estructura base y canvas.** Crear `index.html` con un `<canvas>` de 800x600px y la carga de `game.js` y `assets/spritesheet.js`. Verificar que el canvas se ve en el navegador (fondo simple, sin elementos de juego todavía).

2. **Carga de sprites.** Integrar `loadSpritesheet` de `assets/spritesheet.js` en `game.js`, con un log o dibujo de prueba en el canvas confirmando que la imagen cargó correctamente.

3. **Paleta jugable.** Dibujar la paleta usando `drawSprite`/`drawFrame`, implementar el movimiento con flechas (← / →) y limitarla a los bordes del canvas. El juego es funcional al punto de mover la paleta en pantalla.

4. **Pelota con rebote básico.** Añadir la pelota, su movimiento continuo, y rebote contra las paredes superior/izquierda/derecha y contra la paleta. Sin bloques todavía, la pelota simplemente cae si pasa la paleta (sin lógica de vidas aún).

5. **Grilla de bloques y colisión.** Generar la grilla 10x5 de bloques con los sprites de color, dibujarlos, y detectar colisión pelota-bloque (el bloque se marca `destroyed` y desaparece, la pelota rebota).

6. **Sistema de vidas y reinicio de ronda.** Al caer la pelota por debajo de la paleta, decrementar `lives` y reiniciar posición de pelota/paleta si quedan vidas.

7. **Condiciones de victoria/derrota.** Detectar cuando `lives` llega a 0 (mostrar "Perdiste") o todos los bloques están `destroyed` (mostrar "Ganaste"), cambiar `gameState`, y detener el loop de juego mostrando el mensaje en el canvas.

8. **Reinicio completo por tecla.** En estados `"won"`/`"lost"`, escuchar la tecla R y recrear todas las estructuras (`paddle`, `ball`, `blocks`, `lives`) para iniciar una partida nueva.

## Criterios de aceptación

- [x] Abrir `index.html` en un navegador muestra un canvas de 800x600px con la paleta, la pelota y la grilla de 50 bloques (10x5).
- [x] Las flechas ← / → mueven la paleta horizontalmente, sin salir de los límites del canvas.
- [x] La pelota rebota correctamente contra las paredes superior, izquierda y derecha, y contra la paleta.
- [x] Al golpear un bloque, este desaparece y la pelota rebota en dirección opuesta.
- [x] Al caer la pelota por debajo de la paleta, se pierde una vida y (si quedan vidas) la pelota y la paleta vuelven a su posición inicial.
- [x] Tras perder las 3 vidas, se muestra el mensaje "Perdiste" en el canvas y el juego deja de actualizarse (excepto la escucha de la tecla de reinicio).
- [x] Al destruir los 50 bloques, se muestra el mensaje "Ganaste" en el canvas y el juego deja de actualizarse (excepto la escucha de la tecla de reinicio).
- [x] Presionar la tecla R en pantalla de "Ganaste" o "Perdiste" reinicia la partida completa (vidas en 3, bloques regenerados, paleta y pelota en posición inicial).
- [x] No hay sonido, power-ups, múltiples niveles, ni persistencia de datos en esta versión.

## Decisiones tomadas y descartadas

- **Plataforma: navegador (HTML/Canvas/JS)** en lugar de Python/Pygame como sugería el README. Se eligió porque el único asset de sprites (`assets/spritesheet.js`) ya es un loader funcional para Canvas, evitando reescribir o convertir assets.
- **Un solo nivel fijo (10x5)** en lugar de progresión de niveles. Mantiene el MVP simple; múltiples niveles quedan para un spec futuro.
- **Sin power-ups.** Se descartó para esta versión por decisión explícita del usuario; queda como candidato a spec futuro.
- **Sin sonido**, a pesar de que los archivos `.mp3` ya existen en `assets/sounds/`. Se decidió posponerlo para no ampliar el alcance del MVP.
- **Sin persistencia** (no hay high scores ni guardado de estado). El juego es efímero, todo vive en memoria durante la sesión del navegador.
- **Reinicio manual por tecla (R)** en vez de recarga de página o botón de UI. Se descartó agregar UI adicional (botones, menús) para mantener el MVP mínimo.
- **Un solo archivo `index.html` y un solo `game.js`**, sin separar en módulos (`paddle.js`, `ball.js`, etc.). Se descartó la modularización por ser innecesaria en un proyecto de este tamaño.
- **Sin sistema de puntaje (score) visible.** No fue solicitado; se deja fuera de este MVP.
- **Sin soporte de mouse/touch.** Solo teclado, ya que es suficiente para que el juego sea "jugable" según lo pedido.
