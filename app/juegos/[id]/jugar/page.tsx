"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GAMES } from "@/lib/games";
import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";
import { PLAYABLE } from "@/lib/games/registry";
import type { PlayedSnapshot, PlayedStatus } from "@/lib/games/types";
import type { SessionUser } from "@/lib/supabase/types";

export default function GamePlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const game = GAMES.find((g) => g.id === id);
  const { user } = useAuth();
  const [snapshot, setSnapshot] = useState<PlayedSnapshot | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  // El guardado vive aquí, no en el componente del juego: la página ya recibe el
  // snapshot y ya conoce al usuario, y los juegos siguen sin saber que Supabase
  // existe. Todo en refs porque esto se lee desde el callback del motor, fuera
  // del ciclo de render.
  const statusRef = useRef<PlayedStatus>("ready");
  const startedAtRef = useRef<number | null>(null);
  const savedRef = useRef(false);
  const userRef = useRef<SessionUser>(user);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const handleSnapshot = useCallback(
    (next: PlayedSnapshot) => {
      const prev = statusRef.current;
      statusRef.current = next.status;
      setSnapshot(next);

      // Arranca una partida. Se entra a "playing" desde "ready" (primera) o
      // desde "gameover" (reinicio con Espacio, que salta "ready"); volver de
      // "dead" o de "paused" es la misma partida y no reinicia el cronómetro.
      if (next.status === "playing" && (prev === "ready" || prev === "gameover")) {
        startedAtRef.current = Date.now();
        savedRef.current = false;
        // El aviso pertenece a la partida anterior: la nueva empieza limpia.
        setSaveFailed(false);
        return;
      }

      if (next.status !== "gameover" || prev === "gameover" || savedRef.current) return;

      // Solo se guarda con sesión real: el invitado juega, pero no deja marca.
      const player = userRef.current;
      if (player?.kind !== "supabase") return;

      // Se marca antes del await: si el motor volviera a emitir "gameover",
      // no habría una segunda fila.
      savedRef.current = true;

      const startedAt = startedAtRef.current;
      const durationSeconds = startedAt
        ? Math.max(0, Math.round((Date.now() - startedAt) / 1000))
        : 0;

      void supabase
        .from("scores")
        .insert({
          user_id: player.id,
          game_id: id,
          score: next.score,
          level: next.level,
          duration_seconds: durationSeconds,
        })
        .then(({ error }) => {
          if (!error) return;
          // El fallo se avisa, pero no interrumpe nada: la partida se reinicia
          // con Espacio igual que si hubiera guardado.
          console.error("No se pudo guardar la puntuación", error);
          setSaveFailed(true);
        });
    },
    [supabase, id]
  );

  if (!game) notFound();

  const name = user ? user.username : "INVITADO";
  // El registro decide si hay juego que montar: la página no conoce ningún id.
  const playable = PLAYABLE[game.id];

  // Sin juego montado el HUD conserva los valores decorativos de siempre.
  const score = snapshot?.score ?? 0;
  const lives = snapshot?.lives ?? 3;
  const level = snapshot?.level ?? 1;
  const extraStats = snapshot ? playable?.extraStats?.(snapshot) ?? [] : [];

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: "var(--ink)" }}>
              {name}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{score}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">
              {lives > 0 ? "♥ ".repeat(lives).trim() : "—"}
            </div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(level).padStart(2, "0")}</div>
          </div>
          {extraStats.map((stat) => (
            <div
              key={stat.label}
              className={`hud-stat ${stat.className ?? ""}`.trim()}
            >
              <div className="l">{stat.label}</div>
              <div className="v">{stat.value}</div>
            </div>
          ))}
        </div>
        {saveFailed && (
          <div className="hud-warn" role="status">
            <span className="led" aria-hidden="true"></span>
            NO SE PUDO GUARDAR
          </div>
        )}
        <div className="hud-actions">
          <Link href={`/juegos/${game.id}`} className="btn ghost">
            SALIR
          </Link>
          <Link href="/" className="btn magenta">
            VOLVER AL VAULT
          </Link>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          {playable ? (
            <playable.Game onSnapshot={handleSnapshot} />
          ) : (
            <div className="game-arena">
              <div className="grid-floor"></div>
              <div className="enemy e1"></div>
              <div className="enemy e2"></div>
              <div className="enemy e3"></div>
              <div className="player-ship"></div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {playable && <playable.Controls />}
    </div>
  );
}
