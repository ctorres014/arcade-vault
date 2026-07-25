# Spec 02 — Score, vidas visibles y animación de destrucción

**Estado:** Aprovado
**Dependencias:** SPEC 01 (MVP Arkanoid Jugable)
**Fecha:** 2026-07-06

**Objetivo:** Mostrar el puntaje y las vidas restantes en pantalla durante la partida, y animar la destrucción de bloques con las explosiones ya presentes en el spritesheet.

## Alcance

**Incluido:**
- Puntaje (`score`) visible en la esquina superior izquierda del canvas, que suma 10 puntos por cada bloque destruido.
- Vidas visibles en la esquina superior derecha del canvas, representadas con hasta 3 iconos del sprite `ball` (no texto), que desaparecen uno a uno a medida que se pierden vidas.
- Reinicio de `score` a 0 al reiniciar la partida completa (tecla R en pantalla de victoria/derrota).
- Animación de explosión al destruir un bloque, usando los frames ya definidos en `assets/spritesheet.js` (`EXPLOSION_FRAMES`, `EXPLOSION_DURATION`), reproducida en la posición y tamaño del bloque destruido y descartada automáticamente al finalizar.

**Fuera de alcance (para specs futuros):**
- Persistencia de puntaje (high scores).
- Sonido asociado a la destrucción de bloques o pérdida de vida.
- Multiplicadores de puntaje, combos, o puntaje distinto por color de bloque.
- Animaciones adicionales (paleta, pelota, transición de pantallas).

## Modelo de datos

Extiende el modelo de SPEC 01 en `game.js`:

```js
let score = 0; // entero, +10 por bloque destruido, reinicia a 0 con resetGame()

let explosions = [];
// arreglo de { x, y, width, height, color, startTime }
// uno por cada bloque recién destruido; se descarta cuando
// (performance.now() - startTime) >= EXPLOSION_DURATION
```

Las vidas (`lives`, ya existente desde SPEC 01) no cambian de estructura; solo cambia su representación visual (iconos en vez de texto).

## Plan de implementación

1. **Score visible.** Agregar `score`, incrementarlo en 10 al destruir un bloque, dibujarlo como texto en la esquina superior izquierda, y reiniciarlo en `resetGame()`.
2. **Vidas como iconos.** Reemplazar el texto de vidas por hasta 3 sprites `ball` dibujados en la esquina superior derecha, uno por cada vida restante.
3. **Animación de explosión.** Al destruir un bloque, crear una entrada en `explosions` con su posición/color; en `update()` descartar las que superaron `EXPLOSION_DURATION`; en `draw()` dibujar el frame correspondiente de `EXPLOSION_FRAMES` según el tiempo transcurrido.

## Criterios de aceptación

- [x] El score se muestra en la esquina superior izquierda y aumenta en 10 por cada bloque destruido.
- [x] Las vidas se muestran como iconos de la pelota (no texto) en la esquina superior derecha, y un icono desaparece cada vez que se pierde una vida.
- [x] Al reiniciar la partida con R, el score vuelve a 0 y las 3 vidas/iconos se restauran.
- [x] Al destruir un bloque, se reproduce una animación de explosión de 4 frames en la posición del bloque, con el color correspondiente a la fila, y desaparece sola al terminar.
- [x] No hay persistencia de score ni sonido asociado a estos cambios.

## Decisiones tomadas y descartadas

- **Iconos de pelota para vidas** en lugar de texto ("Vidas: N"), por pedido explícito del usuario, reutilizando el sprite `ball` ya cargado.
- **10 puntos fijos por bloque**, sin variar por color/fila, para mantener el cambio simple; puntajes diferenciados por color queda como candidato a spec futuro.
- **Reutilizar `EXPLOSION_FRAMES`/`EXPLOSION_DURATION`** ya definidos en `assets/spritesheet.js` en lugar de crear una animación custom, ya que el asset estaba preparado para esto y sin usar.
- **Sin sonido de explosión**, aunque `assets/sounds/break-sound.mp3` existe; se descartó para no ampliar el alcance de este spec.
- **Implementación directa sin pasar por `/spec` antes de escribir código** (decisión del usuario en el momento), este documento se redacta después como registro retroactivo de lo ya implementado.

## Qué **no** incluye este spec

- Persistencia de high scores.
- Sonido de destrucción de bloques o pérdida de vida.
- Animaciones para paleta, pelota o transiciones de pantalla.

Cada uno de estos, si se implementa, va en su propio spec.
