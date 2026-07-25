# Spec 03 — Niveles, sonidos, selector de nivel y pausa

**Estado:** Approved
**Dependencias:** SPEC 01 (MVP Arkanoid Jugable), SPEC 02 (Score, vidas visibles y animación de destrucción)
**Fecha:** 2026-07-06

**Objetivo:** Agregar una progresión de 5 niveles con patrones de bloques distintos, sonidos de rebote/destrucción de bloque, un selector de nivel por teclado (1-5) para pruebas, y pausa con la tecla P.

## Alcance

**Incluido:**
- 5 niveles con patrones de bloques distintos entre sí (huecos, formas, no solo grilla completa), definidos como matrices/grid de 0 y 1 por nivel.
- Progresión automática: al destruir todos los bloques de un nivel que no es el último, se muestra un mensaje breve ("Nivel X completado") y se espera una tecla para cargar el siguiente nivel, con paddle/ball reiniciados, manteniendo vidas y score actuales.
- Al completar el nivel 5 (el último), se muestra un mensaje distinto de victoria total (ej. "¡Completaste todos los niveles!"), diferenciado del "Nivel completado" intermedio.
- Sonido de rebote (`ball-bounce.mp3`) al golpear paredes, paleta y bloques.
- Sonido de destrucción (`break-sound.mp3`) al destruir un bloque.
- Sonido de pérdida de vida y de derrota (`break-sound.mp3` reutilizado).
- Sonido de victoria de nivel y victoria total (`ball-bounce.mp3` reutilizado).
- Sonido al entrar y al salir de pausa (`ball-bounce.mp3` reutilizado).
- Control de volumen global: teclas `+`/`-` ajustan el volumen en pasos de 10% (0%-100%), aplicado a todos los efectos de sonido, disponible en todo momento (cualquier `gameState`), sin indicador visible en pantalla.
- Selector de nivel por teclado: teclas 1-5 cargan directamente ese nivel, reiniciando vidas a 3, score a 0, y paddle/ball/blocks del nivel elegido. Solo funciona durante `gameState === 'playing'`.
- Pausa con tecla P: congela `update()` (paddle, pelota, bloques quedan quietos) y muestra un overlay semitransparente con texto "Pausa"; P de nuevo reanuda. Solo disponible durante `gameState === 'playing'`.

**Fuera de alcance (para specs futuros):**
- Persistencia de progreso de nivel, high scores, o preferencia de volumen entre sesiones.
- Indicador visual del nivel de volumen en pantalla.
- Niveles adicionales más allá de 5, o generación procedural de patrones.
- Power-ups.
- Assets de sonido nuevos/dedicados para eventos que hoy reutilizan `ball-bounce.mp3`/`break-sound.mp3`.

## Modelo de datos

Extiende el modelo de SPEC 01/02 en `game.js`:

```js
const LEVELS = [
  // Cada nivel es una matriz de BLOCK_ROWS x BLOCK_COLS con 0 (hueco) y 1 (bloque).
  // Nivel 1: grilla completa (comportamiento actual de SPEC 01/02).
  [ [1,1,1,1,1,1,1,1,1,1], /* ...5 filas... */ ],
  // Niveles 2-5: patrones distintos (huecos, formas), mismas dimensiones 10x5.
  [ /* ... */ ],
  [ /* ... */ ],
  [ /* ... */ ],
  [ /* ... */ ],
];

let currentLevel = 0; // índice 0-4 sobre LEVELS, nivel visible = currentLevel + 1

// createBlocks() pasa a tomar el patrón de LEVELS[currentLevel] en vez de generar
// siempre una grilla completa; cada celda con 1 genera un bloque (color por fila,
// como ya existe vía ROW_COLORS), cada celda con 0 no genera nada.

let paused = false; // true mientras el juego está en pausa (tecla P); update() no corre si es true

let volume = 1.0; // 0.0 a 1.0, en pasos de 0.1, aplicado como .volume a todos los <audio>/sonidos reproducidos

const sounds = {
  bounce: new Audio( 'assets/sounds/ball-bounce.mp3' ),
  destroy: new Audio( 'assets/sounds/break-sound.mp3' ),
};
// bounce se reutiliza para: rebote, victoria de nivel, victoria total, entrar/salir de pausa.
// destroy se reutiliza para: destrucción de bloque, pérdida de vida, derrota.
```

`gameState` (existente desde SPEC 01) se mantiene igual (`"playing"`, `"won"`, `"lost"`), pero se agrega un estado intermedio para nivel completado que no es el último:

```js
// gameState también puede ser 'levelComplete' cuando currentLevel < LEVELS.length - 1
// y se destruyeron todos los bloques del nivel actual (distinto de 'won', que ahora
// significa "completó todos los niveles").
```

## Plan de implementación

1. **Sonidos básicos (rebote y destrucción).** Crear los objetos `Audio` para `bounce` y `destroy`, reproducirlos en los eventos ya existentes de rebote (paredes/paleta/bloques) y destrucción de bloque. El juego sigue funcionando igual que en SPEC 02, ahora con sonido.

2. **Control de volumen.** Agregar variable `volume`, escuchar teclas `+`/`-` para ajustarla en pasos de 0.1 (clamp 0-1), y aplicar `volume` a `sounds.bounce.volume`/`sounds.destroy.volume` antes de cada reproducción. Disponible en cualquier `gameState`.

3. **Pausa con tecla P.** Agregar `paused`, escuchar tecla P (solo si `gameState === 'playing'`) para alternarla, reproducir `sounds.bounce` al entrar y al salir de pausa, saltar `update()` mientras `paused` es `true`, y dibujar overlay semitransparente con texto "Pausa" en `draw()`.

4. **Definir los 5 niveles.** Crear el array `LEVELS` con las 5 matrices 10x5 (nivel 1 = grilla completa actual, niveles 2-5 con patrones distintos), y modificar `createBlocks()` para generar bloques solo en las celdas con `1` del patrón de `LEVELS[currentLevel]`.

5. **Progresión entre niveles.** Al destruir todos los bloques: si `currentLevel < LEVELS.length - 1`, pasar a `gameState = 'levelComplete'`; escuchar una tecla (ej. Espacio) en ese estado para incrementar `currentLevel`, regenerar `blocks` con `createBlocks()`, reiniciar paddle/ball (manteniendo `lives` y `score`), reproducir `sounds.bounce`, y volver a `'playing'`. Si es el último nivel, pasar a `gameState = 'won'` con mensaje de victoria total.

6. **Sonidos de pérdida de vida, derrota y victoria.** Reproducir `sounds.destroy` al perder una vida y al llegar a `gameState = 'lost'`; reproducir `sounds.bounce` al llegar a `gameState = 'levelComplete'` o `'won'`.

7. **Selector de nivel (teclas 1-5).** Escuchar teclas `1`-`5` (solo si `gameState === 'playing'`): al presionar una, fijar `currentLevel` al valor elegido (0-indexado), reiniciar `lives = 3`, `score = 0`, regenerar `blocks` con `createBlocks()`, reiniciar paddle/ball, y limpiar `explosions`.

8. **Ajustes de mensajes en pantalla.** Actualizar `draw()` para mostrar el nivel actual (ej. junto al score), diferenciar visualmente los mensajes "Nivel X completado" (con indicación de tecla para continuar) del mensaje de victoria total y del de derrota.

## Criterios de aceptación

- [ ] Al abrir el juego, se carga el nivel 1 (grilla completa) con sonido de rebote y destrucción funcionando.
- [ ] Existen 5 niveles con patrones de bloques distintos entre sí, cada uno cargado desde una matriz 0/1 en `LEVELS`.
- [ ] Al destruir todos los bloques de un nivel que no es el 5, se muestra "Nivel X completado" y, tras presionar la tecla indicada, se carga el siguiente nivel manteniendo vidas y score.
- [ ] Al destruir todos los bloques del nivel 5, se muestra un mensaje de victoria total distinto del de "Nivel completado".
- [ ] Se escucha `ball-bounce.mp3` en rebotes contra pared/paleta/bloque, al completar un nivel, al ganar la partida total, y al entrar/salir de pausa.
- [ ] Se escucha `break-sound.mp3` al destruir un bloque, al perder una vida, y al perder la partida.
- [ ] Las teclas `+`/`-` suben/bajan el volumen en pasos de 10% (0%-100%), audible en la siguiente reproducción de sonido, funcionando en cualquier estado del juego.
- [ ] Presionar P durante `'playing'` pausa el juego (paddle/pelota/bloques quietos), muestra un overlay "Pausa", y presionarla de nuevo reanuda; ambas transiciones suenan `ball-bounce.mp3`.
- [ ] Presionar una tecla del 1 al 5 durante `'playing'` carga ese nivel directamente, con vidas en 3, score en 0, y paddle/pelota/bloques reiniciados para ese nivel.
- [ ] El selector de nivel (1-5) y la pausa (P) no tienen efecto fuera de `gameState === 'playing'`.

## Decisiones tomadas y descartadas

- **5 niveles con patrones distintos** (huecos, formas) en lugar de solo aumentar filas/velocidad, por pedido explícito del usuario para dar variedad visual real entre niveles.
- **Matrices 0/1 por nivel** en lugar de listas de coordenadas, por ser más simples de leer y editar a mano dentro de `game.js`, sin necesitar un formato externo.
- **Progresión con mensaje intermedio + tecla para continuar**, en vez de carga automática sin pausa, para que el jugador tenga feedback claro de qué nivel completó antes de seguir.
- **Vidas y score se mantienen entre niveles** (no se reinician), y solo vuelven a sus valores iniciales con reinicio completo (R) o con el selector de nivel manual.
- **Selector de nivel (teclas 1-5) reinicia vidas y score**, a diferencia de la progresión normal, porque su propósito es probar niveles de forma aislada, no continuar una partida en curso.
- **Reutilizar los dos sonidos existentes** (`ball-bounce.mp3`, `break-sound.mp3`) para todos los eventos nuevos (pérdida de vida, derrota, victoria de nivel, victoria total, pausa) en lugar de pedir/crear assets nuevos, para no bloquear el spec en assets faltantes.
- **Control de volumen con teclas +/- en pasos de 10%**, sin indicador visible en pantalla, para mantener la UI simple; se descartó mostrar el valor numérico por no ser un requisito explícito.
- **Volumen y pausa restringidos a `gameState === 'playing'`** (excepto volumen, que funciona siempre) según lo definido por el usuario, para evitar que el selector de nivel o la pausa interfieran con las pantallas de mensaje.
- **Sin persistencia de volumen ni de nivel alcanzado** entre sesiones del navegador, consistente con la decisión de SPEC 01 de no agregar persistencia todavía.
