// Contrato entre el motor de canvas y React. El motor no expone el tablero ni
// las piezas: solo lo que el HUD de la plataforma necesita pintar.

export type GameStatus = "ready" | "playing" | "dead" | "paused" | "gameover";

export type GameSnapshot = {
  status: GameStatus;
  score: number;
  /** Siempre 0: Caída no tiene vidas. El HUD lo pinta como "—". */
  lives: number;
  level: number;
  /** Líneas totales limpiadas en la partida. */
  lines: number;
  /** Limpiezas consecutivas; vuelve a 0 al fijar una pieza sin limpiar. */
  combo: number;
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
