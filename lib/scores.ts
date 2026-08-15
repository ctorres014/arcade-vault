import type { SupabaseClient } from "@supabase/supabase-js";
import { seededScores, type ScoreRow } from "@/lib/games";

/**
 * La única puerta a la tabla `scores`. Ninguna función crea su propio cliente:
 * todas reciben el SupabaseClient como primer parámetro, porque la ficha del
 * juego consulta desde el servidor y el Salón y la portada desde el navegador.
 */

/** Fila del ranking tal como vuelve de la consulta, con el join a profiles. */
type TopRow = {
  score: number;
  created_at: string;
  profiles: { username: string } | null;
};

/** Nombre de respaldo si el join a profiles no devuelve fila. */
const UNKNOWN_PLAYER = "JUGADOR";

/**
 * `created_at` a dd/mm/aaaa, el mismo formato que las filas decorativas.
 * Se lee en UTC a propósito: la ficha formatea en el servidor y el Salón en el
 * navegador, y con la zona horaria local las dos pantallas podrían pintar días
 * distintos para la misma partida.
 */
export function formatScoreDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${d.getUTCFullYear()}`;
}

/** Top real de un juego, ya convertido a ScoreRow con filler: false. */
export async function fetchGameTop(
  db: SupabaseClient,
  gameId: string,
  limit: number
): Promise<ScoreRow[]> {
  const { data, error } = await db
    .from("scores")
    .select("score, created_at, profiles(username)")
    .eq("game_id", gameId)
    .order("score", { ascending: false })
    // A igualdad de puntos manda quien lo consiguió antes.
    .order("created_at", { ascending: true })
    .limit(limit)
    .returns<TopRow[]>();

  if (error || !data) {
    console.error("No se pudo leer el ranking de", gameId, error);
    return [];
  }

  return data.map((row, i) => ({
    rank: i + 1,
    name: row.profiles?.username ?? UNKNOWN_PLAYER,
    score: row.score,
    date: formatScoreDate(row.created_at),
    filler: false,
  }));
}

/**
 * Top de jugadores por su mejor puntuación individual en cualquier juego, sin
 * repetir jugador.
 *
 * El cliente de Supabase no tiene `distinct on`, así que se piden las mejores
 * puntuaciones ordenadas y se descarta en memoria todo lo que no sea la primera
 * de cada jugador. Se traen 20 filas por puesto pedido: de sobra salvo que un
 * puñado de jugadores acapare cientos de partidas por delante del resto.
 */
export async function fetchGlobalTop(
  db: SupabaseClient,
  limit: number
): Promise<{ username: string; score: number; gameId: string }[]> {
  const { data, error } = await db
    .from("scores")
    .select("score, game_id, user_id, profiles(username)")
    .order("score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(limit * 20)
    .returns<{
      score: number;
      game_id: string;
      user_id: string;
      profiles: { username: string } | null;
    }[]>();

  if (error || !data) {
    console.error("No se pudo leer el ranking global", error);
    return [];
  }

  const seen = new Set<string>();
  const top: { username: string; score: number; gameId: string }[] = [];

  for (const row of data) {
    if (seen.has(row.user_id)) continue;
    seen.add(row.user_id);
    top.push({
      username: row.profiles?.username ?? UNKNOWN_PLAYER,
      score: row.score,
      gameId: row.game_id,
    });
    if (top.length === limit) break;
  }

  return top;
}

/**
 * Mejor marca del usuario en un juego y su posición global; null si no ha
 * jugado nunca a ese juego.
 *
 * El rango cuenta los jugadores *distintos* con una puntuación mayor que la
 * tuya, más uno: dos partidas mejores del mismo rival no te bajan dos puestos.
 * Se resuelve en memoria sobre las filas devueltas, que con los volúmenes de
 * este proyecto es barato; si la tabla creciera, esto pide una vista SQL o una
 * función rpc, y se cambiaría solo aquí.
 */
export async function fetchUserBest(
  db: SupabaseClient,
  userId: string,
  gameId: string
): Promise<{ score: number; date: string; rank: number } | null> {
  const { data: mine, error } = await db
    .from("scores")
    .select("score, created_at")
    .eq("user_id", userId)
    .eq("game_id", gameId)
    .order("score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .returns<{ score: number; created_at: string }[]>();

  if (error) {
    console.error("No se pudo leer la marca del jugador en", gameId, error);
    return null;
  }

  const best = mine?.[0];
  if (!best) return null;

  const { data: better } = await db
    .from("scores")
    .select("user_id")
    .eq("game_id", gameId)
    .gt("score", best.score)
    .returns<{ user_id: string }[]>();

  const rank = new Set((better ?? []).map((row) => row.user_id)).size + 1;

  return { score: best.score, date: formatScoreDate(best.created_at), rank };
}

/**
 * Agregados de la ficha del juego. `plays` es el número de partidas terminadas
 * y `best` la puntuación más alta; si el juego no tiene ninguna partida vuelven
 * 0 y null, y la ficha cae a los valores decorativos de lib/games.ts.
 */
export async function fetchGameStats(
  db: SupabaseClient,
  gameId: string
): Promise<{ plays: number; best: number | null }> {
  // Un solo viaje: `count` cuenta todas las filas del filtro, y el limit(1)
  // sobre el orden descendente trae la mejor.
  const { data, count, error } = await db
    .from("scores")
    .select("score", { count: "exact" })
    .eq("game_id", gameId)
    .order("score", { ascending: false })
    .limit(1)
    .returns<{ score: number }[]>();

  if (error) {
    console.error("No se pudieron leer las estadísticas de", gameId, error);
    return { plays: 0, best: null };
  }

  return { plays: count ?? 0, best: data?.[0]?.score ?? null };
}

/**
 * Fusiona las marcas reales con el relleno decorativo: las reales se ordenan de
 * mayor a menor y encabezan la tabla, y `seededScores` rellena por debajo hasta
 * completar `total`. Las reales van siempre arriba sin comparar valores, así que
 * una marca real de 800 va por delante de una CPU de 200.000. Los rangos se
 * renumeran del 1 al total después de fusionar.
 */
export function mergeWithFiller(real: ScoreRow[], seed: number, total: number): ScoreRow[] {
  const top = [...real].sort((a, b) => b.score - a.score).slice(0, total);
  const filler = seededScores(seed, total).slice(0, Math.max(total - top.length, 0));

  return [...top, ...filler].map((row, i) => ({ ...row, rank: i + 1 }));
}
