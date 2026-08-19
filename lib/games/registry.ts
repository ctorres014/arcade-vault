import type { ComponentType } from "react";
import { Arkanoid, ArkanoidControls } from "@/components/games/arkanoid";
import { Asteroides, AsteroidesControls } from "@/components/games/asteroides";
import { Caida, CaidaControls } from "@/components/games/caida";
import type { GameSnapshot as ArkanoidSnapshot } from "@/lib/games/arkanoid/types";
import type { GameSnapshot as AsteroidesSnapshot } from "@/lib/games/asteroides/types";
import type { GameSnapshot as CaidaSnapshot } from "@/lib/games/caida/types";
import type { HudStat, PlayedSnapshot } from "@/lib/games/types";

// Lo que la página de juego necesita saber de cada juego jugable. Sustituye a la
// comparación por id que había incrustada en la página: añadir un juego es
// añadir una entrada aquí.
export type PlayableGame = {
  Game: ComponentType<{ onSnapshot?: (snapshot: PlayedSnapshot) => void }>;
  Controls: ComponentType;
  /** hud-stat propios del juego. Devuelve [] cuando no hay nada que mostrar. */
  extraStats?: (snapshot: PlayedSnapshot) => HudStat[];
};

/**
 * Cada entrada se declara con el snapshot de SU juego, ya tipado. El helper
 * concentra en un único punto la conversión a la vista común: en tiempo de
 * ejecución el snapshot que recibe `extraStats` siempre viene del motor de ese
 * mismo juego.
 */
export function definePlayable<S extends PlayedSnapshot>(entry: {
  Game: ComponentType<{ onSnapshot?: (snapshot: S) => void }>;
  Controls: ComponentType;
  extraStats?: (snapshot: S) => HudStat[];
}): PlayableGame {
  return entry as PlayableGame;
}

export const PLAYABLE: Record<string, PlayableGame> = {
  // Sin `extraStats`: el HUD base ya enseña todo lo que Arkanoid tiene.
  arkanoid: definePlayable<ArkanoidSnapshot>({
    Game: Arkanoid,
    Controls: ArkanoidControls,
  }),
  asteroides: definePlayable<AsteroidesSnapshot>({
    Game: Asteroides,
    Controls: AsteroidesControls,
    extraStats: (snapshot) =>
      snapshot.tripleShotLeft > 0
        ? [
            {
              label: "3x",
              value: `${snapshot.tripleShotLeft.toFixed(1)}s`,
              className: "triple",
            },
          ]
        : [],
  }),
  caida: definePlayable<CaidaSnapshot>({
    Game: Caida,
    Controls: CaidaControls,
    extraStats: (snapshot) => [
      { label: "Líneas", value: String(snapshot.lines) },
      // El combo solo se enseña mientras hay racha viva.
      ...(snapshot.combo > 0
        ? [{ label: "Combo", value: `x${snapshot.combo}` }]
        : []),
    ],
  }),
};
