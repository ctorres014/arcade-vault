"use client";

import { useEffect, useRef, useState } from "react";
import { createCaidaGame } from "@/lib/games/caida/engine";
import type { GameSnapshot } from "@/lib/games/caida/types";

export const CAIDA_CONTROLS =
  "← → MOVER · ↓ BAJAR · ↑ / X ROTAR · ESPACIO SOLTAR · P PAUSA";

/** Leyenda de controles. Va debajo del marco CRT, fuera de la pantalla. */
export function CaidaControls() {
  return <p className="game-controls">{CAIDA_CONTROLS}</p>;
}

export function Caida({
  onSnapshot,
}: {
  onSnapshot?: (snapshot: GameSnapshot) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);

  // El motor se crea una sola vez; la prop puede cambiar de identidad en cada
  // render del padre, así que se lee desde un ref en lugar de meterla en las
  // dependencias del efecto.
  const onSnapshotRef = useRef(onSnapshot);
  useEffect(() => {
    onSnapshotRef.current = onSnapshot;
  }, [onSnapshot]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const game = createCaidaGame(canvas, {
      onState: (next) => {
        setSnapshot(next);
        onSnapshotRef.current?.(next);
      },
    });
    game.start();

    // Doble montaje del Strict Mode incluido: destruye el bucle y los listeners.
    return () => game.destroy();
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={600}
      className="game-canvas"
      data-status={snapshot?.status ?? "ready"}
      aria-label="Caída"
    />
  );
}
