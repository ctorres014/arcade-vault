// Vista mínima que la página de juego necesita de cualquier juego jugable. Cada
// juego mantiene su propio contrato en su carpeta; esto solo describe la
// intersección.

export type PlayedStatus = "ready" | "playing" | "dead" | "paused" | "gameover";

/**
 * Supertipo estructural: ningún motor lo importa ni lo implementa. Los snapshots
 * de Asteroides y de Caída encajan aquí por tener estos cuatro campos, y así la
 * página pinta el HUD base y guarda la partida sin conocer ningún juego.
 */
export type PlayedSnapshot = {
  status: PlayedStatus;
  score: number;
  lives: number;
  level: number;
};

export type HudStat = {
  label: string;
  value: string;
  /** Modificador de `.hud-stat` para colorearlo (p. ej. "triple"). */
  className?: string;
};
