# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Arcade Vault (`README.md`) — a neon-arcade platform in Spanish where you play games online and compete for the high score. The catalog has 8 games; two are actually playable (`asteroides`, `caida`), the rest are catalog entries with decorative data. Auth, leaderboards and score persistence run on Supabase.

## Critical: Next.js version

This repo uses **Next.js 16.2.10** with React 19.2.4 — newer than your training data. Before writing App Router code (routing, data fetching, `next/image`, `next/font`, config), check `node_modules/next/dist/docs/01-app/` for current APIs rather than relying on prior knowledge, since conventions may have changed. Example already in the repo: middleware is now **Proxy** — the Supabase session refresh lives in `proxy.ts`, exporting `proxy()`.

## Commands

```bash
npm run dev     # start dev server
npm run build   # production build
npm run start   # run production build
npm run lint    # eslint (flat config, eslint.config.mjs)
```

There is no test runner. Verification = `npm run lint`, `npm run build`, and manual play in the browser.

## Skills

- Usa siempre `/frontend-design` para disenar interfaces de usuario.
- Usa `/nuevo-juego` para portar o montar un juego jugable (`.claude/skills/nuevo-juego/`); codifica el patrón de los specs 05 y 06.

## Architecture

### Routes (`app/`)
- `app/page.tsx` home, `app/games/page.tsx` catalog with search + category filter, `app/about/page.tsx`, `app/auth/page.tsx`, `app/salon-de-la-fama/page.tsx` global hall of fame.
- `app/juegos/[id]/page.tsx` — **server** component: game sheet with the real top-10 and stats from Supabase.
- `app/juegos/[id]/jugar/page.tsx` — **client** component: HUD, mounts the game and owns score persistence.
- `app/api/contact/route.ts` (Resend), `app/auth/callback/route.ts` (Supabase OAuth/PKCE).
- Root layout resolves the session server-side and feeds `AuthProvider` (`context/auth-context.tsx`), so the nav doesn't flicker. `SessionUser` is a union: Supabase user, `guest`, or `null`.

### Games
- `lib/games.ts` — the **visual catalog** (`GAMES`): titles, copy, cover class, decorative `best`/`plays`, plus `seededScores` filler rows. Not the DB.
- `lib/games/<id>/{types.ts,engine.ts}` — pure canvas engine per game: no React, no Supabase, no mutable module globals. Exposes `create<Game>Game(canvas, options): GameController` and emits a `GameSnapshot`.
- `components/games/<id>.tsx` — thin client wrapper (canvas + `Controls` legend).
- `lib/games/registry.ts` — `PLAYABLE` maps game id → `{ Game, Controls, extraStats }` via `definePlayable`. **Adding a playable game is adding an entry here**; the play page never compares ids.
- `lib/games/types.ts` — `PlayedSnapshot` is a structural supertype (`status`, `score`, `lives`, `level`); engines don't import it. The page renders the base HUD from it and `extraStats` adds per-game stats (3x timer, líneas, combo).
- Scores are saved by the play page, not the engine: on the `playing → gameover` transition it inserts into `scores` (guests play but leave no mark).

### Supabase
- `lib/supabase/client.ts` (browser), `lib/supabase/server.ts` (server components), `lib/supabase/types.ts` (row types).
- Migrations in `supabase/migrations/`: `0001_profiles`, `0002_games_scores`, `0003_caida_playable`. Tables `profiles`, `games` (minimal FK reference — the catalog stays in `lib/games.ts`), `scores` (immutable: RLS allows public select and own-row insert only, no update/delete).
- `lib/scores.ts` is the **only** door to the `scores` table; every function takes the `SupabaseClient` as its first argument. `mergeWithFiller` puts real scores on top and pads with CPU filler rows.
- Env vars in `.env.example` (Supabase URL + publishable key, Resend key, contact email).

### Styling
- Tailwind CSS v4 via `@tailwindcss/postcss`, but most of the look is hand-written CSS in `app/globals.css` (~1.4k lines): CSS custom-property theme (`--cyan`, `--magenta`, …), CRT/scanline effects, `.cover-*` classes per game, `.hud-stat`, `.btn`. Fonts via `next/font/google` (Press Start 2P, Courier Prime, JetBrains Mono).
- Path alias `@/*` maps to the repo root (`tsconfig.json`).
- ESLint flat config (`eslint.config.mjs`) extending `eslint-config-next` (core-web-vitals + typescript).

### Reference material
- `references/started-games/` — vanilla originals to port (`02-asteroids`, `03-claude-tetris`, `04-arkanoid`); each has its own `CLAUDE.md`.
- `references/templates/` — the original HTML/JSX design mockups the UI is based on.
- `demos/`, `.playwright-screenshot/` — scratch material, not part of the app.

## Spec-driven workflow

Per `README.md`, this project follows spec-driven design using `/spec` and `/spec-impl`, based on practices from https://github.com/Klerith/fernando-skills (installed via `npx skills@latest add Klerith/fernando-skills`). Approved specs live in `specs/` (01 MVP visual → 08 arkanoid) and are the record of why things are built the way they are — read the relevant one before changing a feature.
