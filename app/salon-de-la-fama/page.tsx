"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GAMES, type ScoreRow } from "@/lib/games";
import { createClient } from "@/lib/supabase/client";
import { fetchGameTop, fetchUserBest, mergeWithFiller } from "@/lib/scores";
import { useAuth } from "@/context/auth-context";

const TOTAL_ROWS = 12;

/** La semilla del relleno es la de siempre, una por pestaña. */
const seedFor = (gameId: string) => gameId.length * 23 + 7;

export default function HallOfFamePage() {
  const [tab, setTab] = useState(GAMES[0].id);
  const { user } = useAuth();

  const supabase = useMemo(() => createClient(), []);
  // Las marcas reales se guardan junto al juego al que pertenecen. Así el
  // render descarta las de la pestaña anterior sin necesidad de limpiarlas.
  const [top, setTop] = useState<{ gameId: string; rows: ScoreRow[] } | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchGameTop(supabase, tab, TOTAL_ROWS).then((real) => {
      if (!cancelled) setTop({ gameId: tab, rows: real });
    });

    return () => {
      cancelled = true;
    };
  }, [supabase, tab]);

  const real = top?.gameId === tab ? top.rows : null;
  const loading = real === null;

  // Mientras carga se pinta solo el relleno de la pestaña activa: la tabla
  // nunca queda vacía ni muestra un instante las marcas del juego anterior.
  const rows = useMemo(
    () => mergeWithFiller(real ?? [], seedFor(tab), TOTAL_ROWS),
    [real, tab]
  );

  // Solo una sesión real tiene marcas: el invitado juega, pero no deja rastro.
  const playerId = user?.kind === "supabase" ? user.id : null;
  const [best, setBest] = useState<{
    gameId: string;
    playerId: string;
    value: Awaited<ReturnType<typeof fetchUserBest>>;
  } | null>(null);

  useEffect(() => {
    if (!playerId) return;
    let cancelled = false;

    fetchUserBest(supabase, playerId, tab).then((value) => {
      if (!cancelled) setBest({ gameId: tab, playerId, value });
    });

    return () => {
      cancelled = true;
    };
  }, [supabase, tab, playerId]);

  const yourBest =
    best && best.gameId === tab && best.playerId === playerId ? best.value : null;

  const game = GAMES.find((g) => g.id === tab);

  const podium = [
    { row: rows[1], cls: "silver", rank: "02" },
    { row: rows[0], cls: "gold", rank: "01" },
    { row: rows[2], cls: "bronze", rank: "03" },
  ];

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA
        </p>
      </div>

      <div className="hall-tabs">
        {GAMES.map((g) => (
          <button
            key={g.id}
            className={"chip" + (tab === g.id ? " active" : "")}
            onClick={() => setTab(g.id)}
          >
            {g.title}
          </button>
        ))}
      </div>

      <div className="hall-loading" role="status" aria-live="polite">
        {loading && (
          <>
            <span className="dot" aria-hidden="true"></span>
            LEYENDO MARCAS
          </>
        )}
      </div>

      <div className="podium">
        {podium.map(({ row, cls, rank }) => (
          <div
            key={cls}
            className={"podium-slot " + cls + (row.filler ? " is-filler" : "")}
          >
            {cls === "gold" && (
              <div
                className="pixel"
                style={{ fontSize: 9, color: "var(--gold)", letterSpacing: "0.18em" }}
              >
                CAMPEÓN
              </div>
            )}
            <div
              className="rank-num"
              style={cls === "gold" ? { fontSize: 36, marginTop: 4 } : undefined}
            >
              {rank}
            </div>
            <div className="name">{row.name}</div>
            <div className="score" style={cls === "gold" ? { fontSize: 20 } : undefined}>
              {row.score.toLocaleString("es-ES")}
            </div>
            <div className="date">{row.date}</div>
          </div>
        ))}
      </div>

      <div className="hall-table">
        <div className="th">
          <div>RANGO</div>
          <div>JUGADOR</div>
          <div>PUNTUACIÓN</div>
          <div>FECHA</div>
        </div>
        {rows.map((r, i) => (
          <div
            key={r.rank}
            className={
              "tr" +
              (i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : "") +
              (r.filler ? " is-filler" : "")
            }
            style={{ animationDelay: `${i * 50}ms` }}
            aria-label={r.filler ? `${r.name}, puntuación de relleno` : undefined}
          >
            <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
            <div className="pl">{r.name}</div>
            <div className="sc">{r.score.toLocaleString("es-ES")}</div>
            <div className="dt">{r.date}</div>
          </div>
        ))}
        {user && game && yourBest && (
          <>
            <div className="tr you-label">▸ TU MEJOR MARCA EN {game.title}</div>
            <div className="tr you" style={{ animationDelay: `${rows.length * 50 + 50}ms` }}>
              <div className="rk" style={{ color: "var(--yellow)" }}>
                #{String(yourBest.rank).padStart(2, "0")}
              </div>
              <div className="pl" style={{ color: "var(--yellow)" }}>
                {user.username}
              </div>
              <div className="sc" style={{ color: "var(--yellow)", textShadow: "0 0 6px rgba(245,255,0,0.5)" }}>
                {yourBest.score.toLocaleString("es-ES")}
              </div>
              <div className="dt">{yourBest.date}</div>
            </div>
          </>
        )}
      </div>

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Link href="/" className="btn lg">
          VOLVER A LA BIBLIOTECA
        </Link>
      </div>
    </div>
  );
}
