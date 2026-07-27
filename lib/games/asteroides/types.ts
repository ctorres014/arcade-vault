// Contrato entre el motor de canvas y React. El motor no expone entidades ni
// posiciones: solo lo que el HUD de la plataforma necesita pintar.

export type GameStatus = "ready" | "playing" | "dead" | "paused" | "gameover";

export type GameSnapshot = {
  status: GameStatus;
  score: number;
  lives: number;
  level: number;
  /** Segundos restantes de disparo triple; 0 si no está activo. */
  tripleShotLeft: number;
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
