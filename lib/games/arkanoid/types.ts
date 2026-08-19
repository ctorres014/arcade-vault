// Contrato entre el motor de canvas y React. El motor no expone la paleta, la
// bola ni los bloques: solo lo que el HUD de la plataforma necesita pintar.

export type GameStatus = "ready" | "playing" | "dead" | "paused" | "gameover";

export type GameSnapshot = {
  /**
   * `dead` queda declarado por contrato pero el motor nunca entra en él: al
   * perder una vida la reaparición es instantánea, como en el original.
   * `levelComplete` viaja como `paused`, con una fase interna que elige el
   * overlay; el contrato solo admite estos cinco estados.
   */
  status: GameStatus;
  score: number;
  /** 3, 2, 1, 0. Este juego sí usa las vidas del HUD base. */
  lives: number;
  /** 1 a 5. Superar el quinto es ganar. */
  level: number;
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
