# Juego de Arkanoid

Un clon de Arkanoid jugable en el navegador, hecho en HTML5 Canvas y JavaScript puro (sin
frameworks, sin build). El objetivo es destruir todos los bloques de cada nivel golpeándolos con
una pelota que rebota, controlando la paleta con el teclado, sin perder las 3 vidas disponibles.

## Cómo jugar

Abrí `index.html` en el navegador (o serví la carpeta con cualquier servidor estático).

**Controles:**

| Tecla       | Acción                                  |
|-------------|------------------------------------------|
| `←` / `→`   | Mover la paleta                          |
| `1`–`5`     | Saltar directamente a ese nivel          |
| `P`         | Pausar / reanudar                        |
| `+` / `-`   | Subir / bajar el volumen                 |
| `R`         | Reiniciar la partida (en victoria/derrota) |
| `Espacio`   | Avanzar al siguiente nivel (al completar uno) |

El juego tiene 5 niveles con patrones de bloques distintos, puntaje (+10 por bloque), 3 vidas
visibles, animación de explosión al destruir bloques, y sonidos de rebote/destrucción.

## Estructura del proyecto

- `index.html` — canvas de 800x600 y carga de scripts.
- `game.js` — toda la lógica del juego (paleta, pelota, niveles, colisiones, vidas, score, pausa, sonido).
- `assets/spritesheet-breakout.png` + `assets/spritesheet.js` — sprites de paleta, pelota, bloques y explosiones.
- `assets/sounds/` — efectos de sonido (rebote, destrucción de bloque).

## Desarrollo

Este proyecto se desarrolla con un flujo spec-driven (`/spec` y `/spec-impl`, ver `specs/` y
`CLAUDE.md`). Cada feature nueva nace como un spec en `specs/NN-slug.md`, se aprueba manualmente, y
recién ahí se implementa en una rama dedicada.
