// Puerto de references/started-games/04-arkanoid/assets/spritesheet.js.
// Solo las regiones del sheet y su carga: aquí no hay nada de jugabilidad.

/** Los cinco colores de fila. `hotpink` y `gray` existen en el sheet original
 *  pero ningún nivel los usa, así que no se portan. */
export type BlockColor = "red" | "yellow" | "green" | "cyan" | "magenta";

export type SpriteRect = { sx: number; sy: number; sw: number; sh: number };

export const SPRITES: {
  paddle: SpriteRect;
  ball: SpriteRect;
  blocks: Record<BlockColor, SpriteRect>;
} = {
  paddle: { sx: 32, sy: 112, sw: 162, sh: 14 },
  ball: { sx: 32, sy: 32, sw: 16, sh: 16 },
  blocks: {
    red: { sx: 32, sy: 176, sw: 32, sh: 16 },
    cyan: { sx: 32, sy: 192, sw: 32, sh: 16 },
    green: { sx: 32, sy: 208, sw: 32, sh: 16 },
    magenta: { sx: 32, sy: 224, sw: 32, sh: 16 },
    yellow: { sx: 32, sy: 240, sw: 32, sh: 16 },
  },
};

/** Cada color tiene 4 frames seguidos en horizontal (x = 256, 288, 320, 352),
 *  en la misma fila `sy` que su bloque. */
export const EXPLOSION_FRAMES: Record<BlockColor, SpriteRect[]> = {
  red: [
    { sx: 256, sy: 176, sw: 32, sh: 16 },
    { sx: 288, sy: 176, sw: 32, sh: 16 },
    { sx: 320, sy: 176, sw: 32, sh: 16 },
    { sx: 352, sy: 176, sw: 32, sh: 16 },
  ],
  cyan: [
    { sx: 256, sy: 192, sw: 32, sh: 16 },
    { sx: 288, sy: 192, sw: 32, sh: 16 },
    { sx: 320, sy: 192, sw: 32, sh: 16 },
    { sx: 352, sy: 192, sw: 32, sh: 16 },
  ],
  green: [
    { sx: 256, sy: 208, sw: 32, sh: 16 },
    { sx: 288, sy: 208, sw: 32, sh: 16 },
    { sx: 320, sy: 208, sw: 32, sh: 16 },
    { sx: 352, sy: 208, sw: 32, sh: 16 },
  ],
  magenta: [
    { sx: 256, sy: 224, sw: 32, sh: 16 },
    { sx: 288, sy: 224, sw: 32, sh: 16 },
    { sx: 320, sy: 224, sw: 32, sh: 16 },
    { sx: 352, sy: 224, sw: 32, sh: 16 },
  ],
  yellow: [
    { sx: 256, sy: 240, sw: 32, sh: 16 },
    { sx: 288, sy: 240, sw: 32, sh: 16 },
    { sx: 320, sy: 240, sw: 32, sh: 16 },
    { sx: 352, sy: 240, sw: 32, sh: 16 },
  ],
};

/** Duración total de la explosión, en milisegundos: 4 frames a ~37,5 ms. */
export const EXPLOSION_DURATION = 150;

const SPRITESHEET_SRC = "/games/arkanoid/spritesheet.png";

/**
 * Única excepción a la regla de "nada de globals de módulo" del contrato: el
 * sheet es un recurso inmutable y compartido, no estado de partida. Cachearlo
 * aquí hace que el doble montaje del Strict Mode descargue el PNG una sola vez,
 * y que dos motores simultáneos compartan la misma imagen.
 */
let cached: Promise<HTMLImageElement> | null = null;

export function loadSpritesheet(): Promise<HTMLImageElement> {
  if (cached) return cached;

  cached = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      // Un fallo no se cachea: al volver a entrar en la ruta se reintenta.
      cached = null;
      reject(new Error("No se pudo cargar el spritesheet de Arkanoid"));
    };
    img.src = SPRITESHEET_SRC;
  });

  return cached;
}
