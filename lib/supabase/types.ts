export type Profile = {
  id: string;
  username: string;
  created_at: string;
};

// Tabla mínima de referencia para la FK de scores. El catálogo visual sigue
// viviendo en lib/games.ts.
export type GameRow = {
  id: string;
  title: string;
  playable: boolean;
};

export type Score = {
  id: string;
  user_id: string;
  game_id: string;
  score: number;
  level: number;
  duration_seconds: number;
  created_at: string;
};

// Lo que devuelve la consulta de ranking, con el join a profiles.
export type ScoreWithPlayer = Score & { profiles: { username: string } | null };

export type SessionUser =
  | { kind: "supabase"; id: string; username: string; email: string }
  | { kind: "guest"; username: "INVITADO" }
  | null;
