# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

Arkanoid clone in the browser: plain HTML5 Canvas + vanilla JS, no build system, no bundler, no
package.json, no test suite. Open `index.html` directly (or serve the folder statically) to play.

- `index.html` — 800x600 canvas, loads `assets/spritesheet.js` then `game.js`.
- `game.js` — the entire game: paddle, ball, block grid per level, collisions, lives, score,
  explosions, level progression, pause, sound, volume control. All game state lives in top-level
  `let`/`const` bindings (`paddle`, `ball`, `blocks`, `lives`, `score`, `currentLevel`, `gameState`,
  `paused`, `volume`, etc.) with a single `update()` / `draw()` / `loop()` cycle driven by
  `requestAnimationFrame`.
- `assets/spritesheet.js` — sprite loader/drawer (`SPRITES`, `EXPLOSION_FRAMES`, `loadSpritesheet`,
  `drawSprite`, `drawFrame`) over `assets/spritesheet-breakout.png`. Reuse these rather than
  re-deriving sprite regions.
- `assets/sounds/ball-bounce.mp3`, `assets/sounds/break-sound.mp3` — sound effects, played via
  `playSound()` in `game.js` respecting the global `volume`.

There is no lint/test/build command to run — verify changes by opening `index.html` in a browser
and exercising the affected states directly.

## Spec-driven workflow (`/spec` and `/spec-impl`)

All features in this repo go through specs stored in `specs/NN-slug.md` (currently `01` through
`03` — see below). Do not implement new features ad hoc; drive them through this flow instead:

1. **`/spec <description>`** — guided, question-driven spec design. Produces `specs/NN-slug.md`
   following the structure in `.agents/skills/spec/template.md`. Never writes code; ends in
   `Draft` state (`Borrador`, etc.) and stops.
2. Human reviews the spec and manually changes its state to `Approved` (or the equivalent word in
   whatever language the spec is written in — the existing specs use `Aprovado`/`Approved`).
3. **`/spec-impl <NN-slug>`** — only proceeds if the spec's state means "Approved" in any
   language; otherwise it refuses and tells the user to run `/spec` again or approve manually.
   On success it creates/switches to a git branch `spec-NN-slug` (auto-created since
   `specs/.spec-config.yml` has `AutoCreateBranch: true`), shows the spec summary (objective,
   scope, plan, acceptance criteria), then implements the plan **one step at a time**, pausing for
   diff review after each step.

Key rules to respect if you are driving either of these skills yourself:
- Specs and skill replies must match the language of the user's initial prompt (the templates are
  bilingual-safe, matching by meaning/position, not exact label text). Existing specs are in
  Spanish.
- Never generate a full spec in one shot — section by section, with confirmation after each.
- Never implement something not in an approved spec's plan; if the plan looks wrong, say so but
  implement what's written, and note the disagreement for the next spec revision.
- Number new specs sequentially (next one is `04-...`) and note their dependency on prior specs in
  the header, following the pattern already used in `specs/02-*` and `specs/03-*`.

### Specs implemented so far

- `01-mvp-arkanoid-jugable.md` — playable core: paddle/ball/one level of 10x5 blocks, 3 lives,
  win/lose messages, full restart.
- `02-score-vidas-explosion.md` — visible score (+10/block) and lives (ball-icon based), block
  explosion animation using `EXPLOSION_FRAMES`.
- `03-niveles-sonidos-pausa.md` — 5 levels with distinct block patterns, bounce/break sounds,
  volume control (`+`/`-`), keyboard level selector (`1`-`5`), pause (`P`).

Read the two most recent specs before starting a new one, per the `/spec` skill's own instructions,
to pick up naming/data-model conventions (e.g. `gameState` values, how `LEVELS` grids are shaped).

## Other installed skills

- `neko` (`.claude/skills/neko/skill.md`) — a persona skill that makes responses cat-like when
  invoked; unrelated to the game itself.
