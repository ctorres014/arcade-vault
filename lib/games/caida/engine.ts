// Motor de Caída. Puerto del Tetris original de
// `references/started-games/03-claude-tetris/game.js`, sin globals de módulo y
// sin React: todo el estado vive dentro de `createCaidaGame`.
//
// Este módulo toca `window`, `document` y `performance`, así que solo debe
// importarse desde un Client Component y usarse dentro de un `useEffect`.

import type {
  EngineOptions,
  GameController,
  GameSnapshot,
  GameStatus,
} from "./types";

// ── Dimensiones ───────────────────────────────────────────────────────────────
// Canvas fijo, igual que Asteroides. El escalado es cosa del CSS.
const W = 800;
const H = 600;

// ── Geometría del tablero ─────────────────────────────────────────────────────
const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

// La lógica trabaja siempre en coordenadas de celda; estos orígenes solo se
// aplican al pintar, para colocar tablero y panel dentro del canvas único.
const BOARD_X = 140;
const BOARD_Y = 0;

/** Panel SIGUIENTE: caja de 4×4 celdas a la derecha del tablero. */
const PANEL_CELLS = 4;
const PANEL_X = 560;
const PANEL_Y = 60;

// ── Paleta ────────────────────────────────────────────────────────────────────
// Skin `retro` del original, sin los otros tres ni el tema claro.
const BG_COLOR = "#0f0f17";
/** En el original se leía de la variable CSS `--color-grid-line`. */
const GRID_LINE_COLOR = "#22222e";
const PANEL_LABEL_COLOR = "#8b8b9e";
/** Opacidad de la pieza fantasma proyectada. */
const GHOST_ALPHA = 0.2;

/** Índice = tipo de pieza. El 0 es celda vacía y no se pinta. */
const COLORS: readonly (string | null)[] = [
  null,
  "#4dd0e1", // I - cian
  "#ffd54f", // O - amarillo
  "#ba68c8", // T - morado
  "#81c784", // S - verde
  "#e57373", // Z - rojo
  "#64b5f6", // J - azul pálido
  "#ffb74d", // L - naranja
  "#90a4ae", // tuerca - gris metálico
];

/**
 * Las 7 piezas estándar más la "tuerca" 3×3 hueca, que es lo que hace distinto
 * a este Tetris. Cada celda guarda su propio tipo, que es también su color.
 */
const PIECES: readonly (number[][] | null)[] = [
  null,
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
  [
    [8, 8, 8],
    [8, 0, 8],
    [8, 8, 8],
  ], // tuerca (hueca)
];

/** Kicks del original: ni SRS ni wall kicks completos, solo desplazamiento. */
const ROTATION_KICKS = [0, -1, 1, -2, 2];

// ── Puntuación y velocidad ────────────────────────────────────────────────────
/** Puntos por limpiar 0, 1, 2, 3 o 4 líneas, multiplicados por el nivel. */
const LINE_SCORES = [0, 100, 300, 500, 800];
const HARD_DROP_POINTS = 2; // por celda recorrida
const SOFT_DROP_POINTS = 1; // por fila bajada a mano

/** Milisegundos entre caídas. Se acelera con el nivel hasta el tope de 100 ms. */
function dropIntervalFor(level: number): number {
  return Math.max(100, 1000 - (level - 1) * 90);
}

// ── Modelo ────────────────────────────────────────────────────────────────────
type Shape = number[][];
/** Matriz ROWS×COLS de tipos de pieza; 0 es hueco. */
type Board = number[][];
type Piece = { type: number; shape: Shape; x: number; y: number };

function createBoard(): Board {
  return Array.from({ length: ROWS }, () => new Array<number>(COLS).fill(0));
}

/** Sorteo uniforme de 1 a 8: la tuerca entra con la misma probabilidad. */
function randomPiece(): Piece {
  const type = Math.floor(Math.random() * 8) + 1;
  const shape = (PIECES[type] as Shape).map((row) => [...row]);
  return {
    type,
    shape,
    x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
    y: 0,
  };
}

/** Rotación por transposición, sin tabla de estados. */
function rotateCW(shape: Shape): Shape {
  const rows = shape.length;
  const cols = shape[0].length;
  const result: Shape = Array.from({ length: cols }, () =>
    new Array<number>(rows).fill(0)
  );
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      result[c][rows - 1 - r] = shape[r][c];
    }
  }
  return result;
}

export function createCaidaGame(
  canvas: HTMLCanvasElement,
  options: EngineOptions
): GameController {
  const ctx2d = canvas.getContext("2d");
  if (!ctx2d) throw new Error("No se pudo obtener el contexto 2D del canvas");
  const ctx: CanvasRenderingContext2D = ctx2d;

  // Estado del tablero. Propiedad del motor, no del módulo: dos motores a la vez
  // no se pisan.
  let board: Board = createBoard();
  let current: Piece = randomPiece();
  let next: Piece = randomPiece();

  // ── Estado de partida ───────────────────────────────────────────────────────
  let status: GameStatus = "ready";
  let score = 0;
  let lines = 0;
  let level = 1;
  let combo = 0;
  let dropAccum = 0;
  let dropInterval = dropIntervalFor(1);

  // ── Colisión y movimiento ───────────────────────────────────────────────────
  // Todo en coordenadas de celda: el desplazamiento del dibujo (BOARD_X) no
  // entra aquí. Las filas negativas se permiten para que la pieza pueda entrar
  // desde arriba.
  function collide(shape: Shape, ox: number, oy: number): boolean {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = ox + c;
        const ny = oy + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && board[ny][nx]) return true;
      }
    }
    return false;
  }

  /** Rota probando los kicks en orden; si ninguno cabe, no rota. */
  function tryRotate(): void {
    const rotated = rotateCW(current.shape);
    for (const kick of ROTATION_KICKS) {
      if (!collide(rotated, current.x + kick, current.y)) {
        current.shape = rotated;
        current.x += kick;
        return;
      }
    }
  }

  /** Fija la pieza actual en el tablero. */
  function merge(): void {
    for (let r = 0; r < current.shape.length; r++) {
      for (let c = 0; c < current.shape[r].length; c++) {
        if (current.shape[r][c]) {
          board[current.y + r][current.x + c] = current.shape[r][c];
        }
      }
    }
  }

  /** Fila en la que caería la pieza actual: la usa el fantasma y el hard drop. */
  function ghostY(): number {
    let gy = current.y;
    while (!collide(current.shape, current.x, gy + 1)) gy++;
    return gy;
  }

  // ── Ciclo de partida ────────────────────────────────────────────────────────

  /**
   * A diferencia del original, solo cambia el estado: no cancela el
   * requestAnimationFrame ni toca el DOM. Con el contrato de la plataforma el
   * bucle es único y solo lo detiene `destroy()`.
   */
  function endGame(): void {
    status = "gameover";
    // Si se muere con Espacio pulsado, no cuenta hasta soltarlo.
    spaceLocked = spaceHeld;
  }

  /** Entra la pieza en espera. Si no cabe al aparecer, se acabó la partida. */
  function spawn(): void {
    current = next;
    next = randomPiece();
    if (collide(current.shape, current.x, current.y)) endGame();
  }

  function clearLines(): void {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r].every((v) => v !== 0)) {
        board.splice(r, 1);
        board.unshift(new Array<number>(COLS).fill(0));
        cleared++;
        r++; // la fila que acaba de bajar hasta aquí todavía no se ha mirado
      }
    }

    if (cleared) {
      combo++;
      lines += cleared;
      score += (LINE_SCORES[cleared] ?? 0) * level;
      level = Math.floor(lines / 10) + 1;
      dropInterval = dropIntervalFor(level);
    } else {
      // Fijar sin limpiar corta la racha.
      combo = 0;
    }
  }

  function lockPiece(): void {
    merge();
    clearLines();
    spawn();
  }

  /** Baja una fila a mano; si ya no puede bajar, fija la pieza. */
  function softDrop(): void {
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
      score += SOFT_DROP_POINTS;
    } else {
      lockPiece();
    }
  }

  /** Suelta la pieza de golpe hasta el fantasma y la fija. */
  function hardDrop(): void {
    const gy = ghostY();
    score += (gy - current.y) * HARD_DROP_POINTS;
    current.y = gy;
    lockPiece();
  }

  /** Deja el motor listo para una partida nueva desde cero. */
  function initGame(): void {
    board = createBoard();
    score = 0;
    lines = 0;
    level = 1;
    combo = 0;
    dropInterval = dropIntervalFor(level);
    dropAccum = 0;
    next = randomPiece();
    spawn();
  }

  // ── Dibujo ──────────────────────────────────────────────────────────────────
  // El desplazamiento entra solo aquí: `originX` / `originY` son píxeles, y
  // `cx` / `cy` siguen siendo celdas.
  function drawBlock(
    originX: number,
    originY: number,
    cx: number,
    cy: number,
    colorIndex: number,
    alpha = 1
  ): void {
    if (!colorIndex) return;
    const color = COLORS[colorIndex];
    if (!color) return;

    const px = originX + cx * BLOCK + 1;
    const py = originY + cy * BLOCK + 1;
    const s = BLOCK - 2;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(px, py, s, s);
    // Brillo superior del original: da volumen al bloque plano.
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(px, py, s, 4);
    ctx.restore();
  }

  /** Pinta una forma completa, saltándose las celdas vacías. */
  function drawShape(
    originX: number,
    originY: number,
    shape: Shape,
    ox: number,
    oy: number,
    alpha = 1
  ): void {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        drawBlock(originX, originY, ox + c, oy + r, shape[r][c], alpha);
      }
    }
  }

  function drawGrid(): void {
    ctx.strokeStyle = GRID_LINE_COLOR;
    ctx.lineWidth = 0.5;
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(BOARD_X + c * BLOCK, BOARD_Y);
      ctx.lineTo(BOARD_X + c * BLOCK, BOARD_Y + ROWS * BLOCK);
      ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(BOARD_X, BOARD_Y + r * BLOCK);
      ctx.lineTo(BOARD_X + COLS * BLOCK, BOARD_Y + r * BLOCK);
      ctx.stroke();
    }
  }

  /** Vista previa de la próxima pieza, centrada en su caja de 4×4. */
  function drawNext(): void {
    ctx.save();
    ctx.fillStyle = PANEL_LABEL_COLOR;
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "left";
    ctx.fillText("SIGUIENTE", PANEL_X, PANEL_Y - 14);
    ctx.restore();

    ctx.strokeStyle = GRID_LINE_COLOR;
    ctx.lineWidth = 1;
    ctx.strokeRect(
      PANEL_X,
      PANEL_Y,
      PANEL_CELLS * BLOCK,
      PANEL_CELLS * BLOCK
    );

    const shape = next.shape;
    const offX = Math.floor((PANEL_CELLS - shape[0].length) / 2);
    const offY = Math.floor((PANEL_CELLS - shape.length) / 2);
    drawShape(PANEL_X, PANEL_Y, shape, offX, offY);
  }

  /** Mismo formato que el overlay de Asteroides, para que la casa sea una. */
  function drawOverlay(title: string, sub = "", titleSize = 46): void {
    ctx.save();
    // Velo: sobre un tablero lleno de bloques el texto se pierde.
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${titleSize}px monospace`;
    ctx.fillText(title, W / 2, sub ? H / 2 - 18 : H / 2);
    if (sub) {
      ctx.font = "18px monospace";
      ctx.fillStyle = "rgba(255,255,255,0.65)";
      ctx.fillText(sub, W / 2, H / 2 + 22);
    }
    ctx.restore();
  }

  // Sin HUD: puntuación, líneas y nivel los pinta React desde el snapshot.
  function draw(): void {
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, W, H);

    drawGrid();

    // Piezas ya fijadas.
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        drawBlock(BOARD_X, BOARD_Y, c, r, board[r][c]);
      }
    }

    // Fantasma: dónde caería la pieza si se soltase ahora.
    drawShape(
      BOARD_X,
      BOARD_Y,
      current.shape,
      current.x,
      ghostY(),
      GHOST_ALPHA
    );

    drawShape(BOARD_X, BOARD_Y, current.shape, current.x, current.y);

    drawNext();

    if (status === "ready") {
      drawOverlay("PULSA ESPACIO PARA EMPEZAR", "", 28);
    } else if (status === "paused") {
      drawOverlay("PAUSA");
    } else if (status === "gameover") {
      drawOverlay("GAME OVER", `PUNTAJE: ${score}   —   ESPACIO PARA REINICIAR`);
    }
  }

  // ── Snapshot ────────────────────────────────────────────────────────────────
  let lastSnapshot: GameSnapshot | null = null;

  /**
   * Se llama en cada frame, así que solo emite cuando algo ha cambiado: si no,
   * React re-renderizaría el HUD 60 veces por segundo. Todos los campos son
   * enteros, así que no hace falta redondear como en Asteroides.
   */
  function emitState(): void {
    const snapshot: GameSnapshot = {
      status,
      score,
      lives: 0, // Caída no tiene vidas; el HUD lo pinta como "—"
      level,
      lines,
      combo,
    };

    const prev = lastSnapshot;
    if (
      prev !== null &&
      prev.status === snapshot.status &&
      prev.score === snapshot.score &&
      prev.lives === snapshot.lives &&
      prev.level === snapshot.level &&
      prev.lines === snapshot.lines &&
      prev.combo === snapshot.combo
    ) {
      return;
    }

    lastSnapshot = snapshot;
    options.onState(snapshot);
  }

  // ── Bucle ───────────────────────────────────────────────────────────────────
  let rafId: number | null = null;
  let lastTime: number | null = null;
  let destroyed = false;

  /** Caída por gravedad: no puntúa, a diferencia del soft drop. */
  function gravityDrop(): void {
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }

  function loop(ts: number): void {
    rafId = requestAnimationFrame(loop);
    // El acumulador del original trabaja en milisegundos y se conserva tal cual.
    // dt capado a 50 ms: evita que volver de una pestaña oculta baje la pieza de
    // golpe.
    const dt = lastTime === null ? 0 : Math.min(ts - lastTime, 50);
    lastTime = ts;

    // En `ready`, `paused` y `gameover` el tablero se congela, pero se sigue
    // pintando para que los overlays estén vivos.
    if (status === "playing") {
      dropAccum += dt;
      if (dropAccum >= dropInterval) {
        dropAccum = 0;
        gravityDrop();
      }
    }

    draw();
    emitState();
  }

  // ── Pausa ───────────────────────────────────────────────────────────────────
  function pause(): void {
    if (status !== "playing") return;
    status = "paused";
  }

  function resume(): void {
    if (status !== "paused") return;
    status = "playing";
    // Sin esto, el tiempo pasado en pausa se cobra de golpe en cuanto se vuelve.
    dropAccum = 0;
  }

  // ── Input ───────────────────────────────────────────────────────────────────
  // En `window` y no en el canvas: el canvas no es focusable sin `tabIndex`.
  const PREVENT_DEFAULT = new Set([
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "Space",
  ]);

  /**
   * `Espacio` hace tres cosas según el estado, así que al entrar en `ready` o en
   * `gameover` con la tecla ya pulsada se ignora hasta soltarla: morir mientras
   * se sueltan piezas no debe reiniciar la partida antes de leer la puntuación.
   */
  let spaceHeld = false;
  let spaceLocked = false;

  function onKeyDown(e: KeyboardEvent): void {
    if (PREVENT_DEFAULT.has(e.code)) e.preventDefault();

    if (e.code === "KeyP" || e.code === "Escape") {
      if (e.repeat) return;
      if (status === "paused") resume();
      else pause();
      return;
    }

    if (e.code === "Space") {
      spaceHeld = true;
      // Autorrepetición bloqueada: mantener Espacio suelta una pieza, no una por
      // evento como en el original.
      if (e.repeat || spaceLocked) return;
      if (status === "ready" || status === "gameover") {
        startRound();
      } else if (status === "playing") {
        hardDrop();
      }
      return;
    }

    if (status !== "playing") return;

    switch (e.code) {
      // La autorrepetición del teclado se conserva en movimiento y soft drop:
      // es lo que da el desplazamiento continuo al mantener la tecla.
      case "ArrowLeft":
        if (!collide(current.shape, current.x - 1, current.y)) current.x--;
        break;
      case "ArrowRight":
        if (!collide(current.shape, current.x + 1, current.y)) current.x++;
        break;
      case "ArrowDown":
        softDrop();
        break;
      case "ArrowUp":
      case "KeyX":
        if (e.repeat) return; // rotar en bucle al mantener la tecla marea
        tryRotate();
        break;
    }
  }

  function onKeyUp(e: KeyboardEvent): void {
    if (e.code === "Space") {
      spaceHeld = false;
      spaceLocked = false;
    }
  }

  function onVisibilityChange(): void {
    if (document.hidden) pause();
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  document.addEventListener("visibilitychange", onVisibilityChange);

  /** Arranca una partida desde cero, venga de `ready` o de `gameover`. */
  function startRound(): void {
    initGame();
    // `initGame` puede morir al primer spawn solo con el tablero lleno, lo que
    // aquí no puede pasar: el tablero está recién creado.
    status = "playing";
  }

  // Partida lista pero congelada: se ve el tablero vacío hasta que el jugador
  // arranca con Espacio.
  initGame();
  status = "ready";
  draw();
  emitState();

  return {
    start() {
      // Guarda contra el doble montaje del Strict Mode: un solo bucle vivo.
      if (destroyed || rafId !== null) return;
      lastTime = null;
      rafId = requestAnimationFrame(loop);
    },
    pause,
    resume,
    restart() {
      startRound();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    },
  };
}
