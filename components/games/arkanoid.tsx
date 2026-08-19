"use client";

import { useEffect, useRef, useState } from "react";
import { createArkanoidGame } from "@/lib/games/arkanoid/engine";
import type { GameSnapshot } from "@/lib/games/arkanoid/types";

export const ARKANOID_CONTROLS =
  "← → MOVER · ESPACIO EMPEZAR / CONTINUAR · P PAUSA";

/** Leyenda de controles. Va debajo del marco CRT, fuera de la pantalla. */
export function ArkanoidControls() {
  return <p className="game-controls">{ARKANOID_CONTROLS}</p>;
}

export function Arkanoid({
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

    const game = createArkanoidGame(canvas, {
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
      aria-label="Arkanoid"
    />
  );
}
