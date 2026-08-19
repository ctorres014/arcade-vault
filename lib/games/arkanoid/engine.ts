// Motor de Arkanoid. Puerto del original de
// `references/started-games/04-arkanoid/game.js`, sin globals de módulo y sin
// React: todo el estado vive dentro de `createArkanoidGame`.
//
// Este módulo toca `window`, `document` y `Image`, así que solo debe importarse
// desde un Client Component y usarse dentro de un `useEffect`.

import {
  EXPLOSION_DURATION,
  EXPLOSION_FRAMES,
  loadSpritesheet,
  SPRITES,
  type BlockColor,
  type SpriteRect,
} from "./sprites";
import type {
  EngineOptions,
  GameController,
  GameSnapshot,
  GameStatus,
} from "./types";

// ── Dimensiones ───────────────────────────────────────────────────────────────
// Canvas fijo, igual que Asteroides y Caída. El escalado es cosa del CSS.
const W = 800;
const H = 600;

const BG_COLOR = "#0a0a0f";

// ── Paleta y bola ─────────────────────────────────────────────────────────────
const PADDLE_W = 162;
const PADDLE_H = 14;
const PADDLE_Y = 550;
const BALL_R = 8;

// ── Grilla de bloques ─────────────────────────────────────────────────────────
const BLOCK_COLS = 10;
const BLOCK_ROWS = 5;
const BLOCK_W = 76;
const BLOCK_H = 24;
const BLOCK_PADDING = 4;
const BLOCK_OFFSET_TOP = 50;
/** Centra la grilla en el canvas: da 2 px con las constantes de arriba. */
const BLOCK_OFFSET_LEFT =
  (W - (BLOCK_COLS * (BLOCK_W + BLOCK_PADDING) - BLOCK_PADDING)) / 2;

/** Color por fila, de arriba abajo. Es también el color de su explosión. */
const ROW_COLORS: readonly BlockColor[] = [
  "red",
  "yellow",
  "green",
  "cyan",
  "magenta",
];

// ── Partida ───────────────────────────────────────────────────────────────────
const POINTS_PER_BLOCK = 10;
const START_LIVES = 3;

// ── Velocidades ───────────────────────────────────────────────────────────────
// El original avanza por frame; aquí se trabaja en píxeles por segundo, así que
// todo se multiplica por 60, que es la velocidad a la que el juego se diseñó.

/** Original: `paddle.speed = 7` por frame. */
const PADDLE_SPEED = 7 * 60;

/** Original: `dx = 4, dy = -4` por frame, o sea 45° a módulo constante. */
const BALL_SPEED = Math.hypot(4, 4) * 60;

/** La bola acelera un 10 % por nivel: los patrones van a menos bloques. */
const LEVEL_SPEEDUP = 1.1;

/**
 * Apertura máxima del rebote en la paleta, respecto a la vertical. A 60° la
 * componente vertical nunca baja de la mitad de la velocidad: con 90° un golpe
 * con el extremo dejaría la bola casi horizontal y tardaría siglos en bajar.
 */
const MAX_BOUNCE_ANGLE = (60 * Math.PI) / 180;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

/**
 * Los cinco patrones, tal cual el original: grilla completa, huecos alternos,
 * pirámide, diamante y marco hueco. 50, 44, 30, 34 y 26 bloques.
 */
const LEVELS: readonly (readonly (readonly number[])[])[] = [
  // Nivel 1: grilla completa.
  [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  ],
  // Nivel 2: filas alternadas con huecos cada 3 columnas.
  [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 0, 1, 1, 0, 1, 1, 0, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 0, 1, 1, 0, 1, 1, 0, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  ],
  // Nivel 3: pirámide.
  [
    [0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 1, 1, 1, 1, 0, 0, 0],
    [0, 0, 1, 1, 1, 1, 1, 1, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  ],
  // Nivel 4: diamante.
  [
    [0, 0, 0, 1, 1, 1, 1, 0, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 0, 0, 1, 1, 1, 1, 0, 0, 0],
  ],
  // Nivel 5: marco hueco.
  [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  ],
];

type Paddle = { x: number; y: number; width: number; height: number };
type Ball = { x: number; y: number; radius: number; dx: number; dy: number };
type Block = {
  x: number;
  y: number;
  width: number;
  height: number;
  color: BlockColor;
  destroyed: boolean;
};
/** `elapsed` acumula `dt` en vez de leer el reloj: así se congela en pausa. */
type Explosion = {
  x: number;
  y: number;
  width: number;
  height: number;
  color: BlockColor;
  elapsed: number;
};

export function createArkanoidGame(
  canvas: HTMLCanvasElement,
  options: EngineOptions
): GameController {
  const ctx2d = canvas.getContext("2d");
  if (!ctx2d) throw new Error("No se pudo obtener el contexto 2D del canvas");
  const ctx: CanvasRenderingContext2D = ctx2d;

  canvas.width = W;
  canvas.height = H;

  // ── Estado de la partida ────────────────────────────────────────────────────
  // Propiedad del motor, no del módulo: dos motores a la vez no se pisan.
  const paddle: Paddle = {
    x: (W - PADDLE_W) / 2,
    y: PADDLE_Y,
    width: PADDLE_W,
    height: PADDLE_H,
  };

  const ball: Ball = {
    x: W / 2,
    y: PADDLE_Y - BALL_R,
    radius: BALL_R,
    dx: 0,
    dy: 0,
  };

  let blocks: Block[] = [];
  let explosions: Explosion[] = [];
  let lives = START_LIVES;
  let score = 0;
  /** Índice en `LEVELS`, de 0 a 4. El HUD muestra `currentLevel + 1`. */
  let currentLevel = 0;
  let status: GameStatus = "ready";

  /**
   * El spritesheet. `null` hasta que resuelve la carga, y esa nulidad es el
   * flag de "sprites listos": mientras lo sea, el canvas pinta `CARGANDO…` y
   * `Espacio` no arranca nada. Es imposible jugar una partida invisible.
   */
  let sheet: HTMLImageElement | null = null;

  /**
   * Qué overlay se pinta cuando `status` es `paused`, y cómo terminó la partida
   * cuando es `gameover`. Los dos son internos: no salen en el snapshot, porque
   * el contrato solo admite los cinco estados de `PlayedStatus`.
   */
  let phase: "playing" | "levelComplete" = "playing";
  let outcome: "lost" | "won" = "lost";

  /** Flechas pulsadas, sostenidas entre frames por los listeners de teclado. */
  const keys = { left: false, right: false };

  /** Velocidad de la bola en el nivel actual. */
  function levelSpeed(): number {
    return BALL_SPEED * LEVEL_SPEEDUP ** currentLevel;
  }

  /** Bloques vivos del patrón del nivel actual. */
  function createBlocks(): Block[] {
    const pattern = LEVELS[currentLevel];
    const created: Block[] = [];

    for (let row = 0; row < BLOCK_ROWS; row++) {
      for (let col = 0; col < BLOCK_COLS; col++) {
        if (pattern[row][col] === 0) continue;
        created.push({
          x: BLOCK_OFFSET_LEFT + col * (BLOCK_W + BLOCK_PADDING),
          y: BLOCK_OFFSET_TOP + row * (BLOCK_H + BLOCK_PADDING),
          width: BLOCK_W,
          height: BLOCK_H,
          color: ROW_COLORS[row],
          destroyed: false,
        });
      }
    }

    return created;
  }

  /**
   * Recoloca paleta y bola al centro y relanza a 45° hacia arriba y a la
   * derecha, como el original, pero con la velocidad del nivel actual.
   */
  function resetPaddleAndBall(): void {
    paddle.x = (W - paddle.width) / 2;
    ball.x = W / 2;
    ball.y = PADDLE_Y - BALL_R;
    // Las componentes de un vector a 45°: cada una es speed / √2.
    const component = levelSpeed() / Math.SQRT2;
    ball.dx = component;
    ball.dy = -component;
  }

  /** Partida desde cero: puntuación, vidas y nivel 1. */
  function initGame(): void {
    lives = START_LIVES;
    score = 0;
    currentLevel = 0;
    blocks = createBlocks();
    explosions = [];
    resetPaddleAndBall();
  }

  /** Siguiente nivel conservando puntuación y vidas. */
  function advanceLevel(): void {
    currentLevel++;
    blocks = createBlocks();
    explosions = [];
    resetPaddleAndBall();
  }

  // ── Simulación ──────────────────────────────────────────────────────────────

  /** Pierde una vida: reaparición instantánea, o fin de partida sin vidas. */
  function loseLife(): void {
    lives--;
    if (lives > 0) {
      // Sin estado intermedio: el contrato declara `dead` pero aquí no se usa.
      resetPaddleAndBall();
      return;
    }
    outcome = "lost";
    status = "gameover";
    // Si se muere con Espacio pulsado, no cuenta hasta soltarlo.
    spaceLocked = spaceHeld;
  }

  /** Rebote en la paleta: el punto de impacto elige el ángulo de salida. */
  function bounceOffPaddle(): void {
    ball.y = paddle.y - ball.radius;

    // -1 en el extremo izquierdo de la paleta, 0 en el centro, 1 en el derecho.
    const hit = clamp(
      (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2),
      -1,
      1
    );
    const angle = hit * MAX_BOUNCE_ANGLE;
    // El módulo se conserva: el rebote dirige la bola, no la acelera.
    const speed = levelSpeed();
    ball.dx = speed * Math.sin(angle);
    ball.dy = -speed * Math.cos(angle);
  }

  /**
   * Colisión bola-bloque por punto más cercano, con inversión del eje de mayor
   * penetración. Se rompe un bloque por paso como en el original: el `break`
   * puede ignorar una segunda colisión real, y como mucho eso deja un bloque
   * vivo un frame de más.
   */
  function hitBlocks(): void {
    for (const block of blocks) {
      if (block.destroyed) continue;

      const closestX = clamp(ball.x, block.x, block.x + block.width);
      const closestY = clamp(ball.y, block.y, block.y + block.height);
      const dx = ball.x - closestX;
      const dy = ball.y - closestY;

      if (dx * dx + dy * dy > ball.radius * ball.radius) continue;

      block.destroyed = true;
      score += POINTS_PER_BLOCK;
      explosions.push({
        x: block.x,
        y: block.y,
        width: block.width,
        height: block.height,
        color: block.color,
        elapsed: 0,
      });

      if (Math.abs(dx) > Math.abs(dy)) ball.dx = -ball.dx;
      else ball.dy = -ball.dy;
      break;
    }
  }

  /** `dt` en segundos, ya capado por el bucle. */
  function update(dt: number): void {
    if (keys.left) paddle.x -= PADDLE_SPEED * dt;
    if (keys.right) paddle.x += PADDLE_SPEED * dt;
    paddle.x = clamp(paddle.x, 0, W - paddle.width);

    ball.x += ball.dx * dt;
    ball.y += ball.dy * dt;

    // Paredes: reposición al borde e inversión del eje, como el original.
    if (ball.x - ball.radius < 0) {
      ball.x = ball.radius;
      ball.dx = -ball.dx;
    } else if (ball.x + ball.radius > W) {
      ball.x = W - ball.radius;
      ball.dx = -ball.dx;
    }

    if (ball.y - ball.radius < 0) {
      ball.y = ball.radius;
      ball.dy = -ball.dy;
    }

    // Se comprueba por banda y solo bajando, para que un paso largo no atraviese
    // la paleta y para que rozarla desde abajo no rebote.
    const hitsPaddle =
      ball.dy > 0 &&
      ball.y + ball.radius >= paddle.y &&
      ball.y + ball.radius <= paddle.y + paddle.height &&
      ball.x >= paddle.x &&
      ball.x <= paddle.x + paddle.width;

    if (hitsPaddle) bounceOffPaddle();

    hitBlocks();

    if (ball.y - ball.radius > H) loseLife();

    // No colisiona con la pérdida de vida de arriba: para salir por abajo la
    // bola tiene que estar a 600 px, y para romper un bloque a menos de 200.
    if (blocks.every((block) => block.destroyed)) {
      if (currentLevel < LEVELS.length - 1) {
        // Congelado esperando a Espacio: `paused` con la fase que elige overlay.
        phase = "levelComplete";
        status = "paused";
      } else {
        outcome = "won";
        status = "gameover";
      }
      // Limpiar el nivel con Espacio pulsado no salta al siguiente ni reinicia.
      spaceLocked = spaceHeld;
    }

    // Las explosiones acumulan el tiempo del juego, en milisegundos.
    for (const explosion of explosions) explosion.elapsed += dt * 1000;
    explosions = explosions.filter(
      (explosion) => explosion.elapsed < EXPLOSION_DURATION
    );
  }

  // ── Dibujo ──────────────────────────────────────────────────────────────────
  // Aquí no se pinta ni puntuación, ni nivel, ni iconos de vida: eso es el HUD
  // de React. El original los dibujaba dentro del canvas.

  /** Recorta una región del sheet. No hace nada mientras el PNG no ha cargado. */
  function drawSprite(
    rect: SpriteRect,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    if (!sheet) return;
    ctx.drawImage(sheet, rect.sx, rect.sy, rect.sw, rect.sh, x, y, w, h);
  }

  /** Frame de la explosión según lo que lleve acumulado; el último se sostiene. */
  function explosionFrame(explosion: Explosion): SpriteRect {
    const frames = EXPLOSION_FRAMES[explosion.color];
    const index = Math.floor(
      explosion.elapsed / (EXPLOSION_DURATION / frames.length)
    );
    return frames[Math.min(index, frames.length - 1)];
  }

  function draw(): void {
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, W, H);

    drawSprite(SPRITES.paddle, paddle.x, paddle.y, paddle.width, paddle.height);
    drawSprite(
      SPRITES.ball,
      ball.x - ball.radius,
      ball.y - ball.radius,
      ball.radius * 2,
      ball.radius * 2
    );

    for (const block of blocks) {
      if (block.destroyed) continue;
      drawSprite(
        SPRITES.blocks[block.color],
        block.x,
        block.y,
        block.width,
        block.height
      );
    }

    // Después de los bloques: la explosión ocupa el hueco del que acaba de caer.
    for (const explosion of explosions) {
      drawSprite(
        explosionFrame(explosion),
        explosion.x,
        explosion.y,
        explosion.width,
        explosion.height
      );
    }

    drawOverlays();
  }

  /** Mismo formato que el overlay de Asteroides y Caída: la casa es una. */
  function drawOverlay(title: string, sub = "", titleSize = 46): void {
    ctx.save();
    // Velo: sobre la grilla de bloques el texto se pierde.
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

  function drawOverlays(): void {
    // La carga manda sobre todo lo demás: sin sprites no hay nada que enseñar.
    if (!sheet) {
      drawOverlay("CARGANDO…", "", 32);
      return;
    }

    if (status === "ready") {
      drawOverlay("PULSA ESPACIO PARA EMPEZAR", "", 28);
    } else if (status === "paused") {
      if (phase === "levelComplete") {
        drawOverlay(
          `NIVEL ${currentLevel + 1} COMPLETADO`,
          "ESPACIO PARA CONTINUAR",
          38
        );
      } else {
        drawOverlay("PAUSA");
      }
    } else if (status === "gameover") {
      drawOverlay(
        outcome === "won" ? "¡NIVELES COMPLETADOS!" : "GAME OVER",
        `PUNTAJE: ${score}   —   ESPACIO PARA REINICIAR`,
        outcome === "won" ? 38 : 46
      );
    }
  }

  // ── Snapshot ────────────────────────────────────────────────────────────────

  let lastSnapshot: GameSnapshot | null = null;

  /**
   * Se llama en cada frame, pero solo avisa a React cuando algo cambia de
   * verdad: sin esta comparación el HUD volvería a renderizar 60 veces por
   * segundo. Los cuatro campos son enteros, así que no hace falta redondear
   * como en Asteroides.
   *
   * `phase` y `outcome` no salen aquí: son internos y solo eligen overlay.
   */
  function emitState(): void {
    const snapshot: GameSnapshot = {
      status,
      score,
      lives,
      // El motor cuenta niveles desde 0 y el HUD los enseña desde 1.
      level: currentLevel + 1,
    };

    const prev = lastSnapshot;
    if (
      prev !== null &&
      prev.status === snapshot.status &&
      prev.score === snapshot.score &&
      prev.lives === snapshot.lives &&
      prev.level === snapshot.level
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

  function loop(ts: number): void {
    rafId = requestAnimationFrame(loop);
    // dt en segundos, capado a 50 ms como en Asteroides y Caída: volver de una
    // pestaña oculta no debe teletransportar la bola media pantalla.
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;

    // En `ready`, `paused` y `gameover` todo se congela, pero se sigue pintando
    // para que los overlays estén vivos.
    if (status === "playing") update(dt);

    draw();
    emitState();
  }

  // ── Pausa ───────────────────────────────────────────────────────────────────
  function pause(): void {
    if (status !== "playing") return;
    phase = "playing";
    status = "paused";
  }

  function resume(): void {
    // El overlay de nivel completado también es `paused`, pero de ahí solo se
    // sale con Espacio: reanudarlo aquí saltaría el nivel sin cargar el patrón.
    if (status !== "paused" || phase === "levelComplete") return;
    status = "playing";
  }

  // ── Ciclo de partida ────────────────────────────────────────────────────────

  /** Arranca desde cero, venga de `ready` o de `gameover`. */
  function startRound(): void {
    initGame();
    phase = "playing";
    status = "playing";
  }

  /** Carga el siguiente patrón conservando puntuación y vidas. */
  function continueToNextLevel(): void {
    advanceLevel();
    phase = "playing";
    status = "playing";
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
   * `Espacio` tiene cuatro significados según el estado, así que al entrar en
   * uno nuevo con la tecla ya pulsada se ignora hasta soltarla: morir o limpiar
   * un nivel con Espacio apretado no debe encadenar la acción siguiente.
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
      // Autorrepetición bloqueada: mantener Espacio no encadena acciones.
      if (e.repeat || spaceLocked) return;
      // Sin sprites no se arranca: se vería una partida invisible.
      if (!sheet) return;
      if (status === "ready" || status === "gameover") {
        startRound();
      } else if (status === "paused" && phase === "levelComplete") {
        continueToNextLevel();
      }
      return;
    }

    // La autorrepetición se conserva en las flechas: es lo que da el
    // desplazamiento continuo de la paleta.
    if (e.code === "ArrowLeft") keys.left = true;
    else if (e.code === "ArrowRight") keys.right = true;
  }

  function onKeyUp(e: KeyboardEvent): void {
    if (e.code === "Space") {
      spaceHeld = false;
      spaceLocked = false;
    } else if (e.code === "ArrowLeft") {
      keys.left = false;
    } else if (e.code === "ArrowRight") {
      keys.right = false;
    }
  }

  function onVisibilityChange(): void {
    if (document.hidden) pause();
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  document.addEventListener("visibilitychange", onVisibilityChange);

  // Partida lista pero congelada: el campo está montado y esperando a Espacio.
  initGame();
  status = "ready";
  draw();
  emitState();

  // La imagen está cacheada en el módulo, así que entrar y salir de la ruta no
  // vuelve a descargarla. Si el motor ya murió cuando resuelve, no se toca nada:
  // es el caso normal del doble montaje del Strict Mode.
  void loadSpritesheet()
    .then((image) => {
      if (destroyed) return;
      sheet = image;
      // Repinta ya, para que el overlay pase de `CARGANDO…` a `PULSA ESPACIO`
      // aunque el bucle todavía no esté corriendo.
      draw();
    })
    .catch((error: unknown) => {
      if (destroyed) return;
      // El canvas se queda en `CARGANDO…`: sin sprites no hay partida posible.
      console.error("Arkanoid se queda sin sprites", error);
    });

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
