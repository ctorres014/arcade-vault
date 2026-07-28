"use client";

import { use, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GAMES } from "@/lib/games";
import { useAuth } from "@/context/auth-context";
import { Asteroides, AsteroidesControls } from "@/components/games/asteroides";
import type { GameSnapshot } from "@/lib/games/asteroides/types";

export default function GamePlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const game = GAMES.find((g) => g.id === id);
  const { user } = useAuth();
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);

  if (!game) notFound();

  const name = user ? user.username : "INVITADO";
  const isPlayable = game.id === "asteroides";

  // Sin juego montado el HUD conserva los valores decorativos de siempre.
  const score = snapshot?.score ?? 0;
  const lives = snapshot?.lives ?? 3;
  const level = snapshot?.level ?? 1;
  const tripleShotLeft = snapshot?.tripleShotLeft ?? 0;

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
          {tripleShotLeft > 0 && (
            <div className="hud-stat triple">
              <div className="l">3x</div>
              <div className="v">{tripleShotLeft.toFixed(1)}s</div>
            </div>
          )}
        </div>
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
          {isPlayable ? (
            <Asteroides onSnapshot={setSnapshot} />
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

      {isPlayable && <AsteroidesControls />}
    </div>
  );
}
