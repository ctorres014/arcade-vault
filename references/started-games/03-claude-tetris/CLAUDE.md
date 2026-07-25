# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Classic Tetris implemented in vanilla JavaScript (ES6+) with HTML5 Canvas and CSS. No dependencies, no build step, no package.json — three files: `index.html`, `style.css`, `game.js`.

## Running / testing

There is no build, lint, or test tooling in this repo. To run the game, just serve or open `index.html`:

```bash
# Open directly
start index.html        # Windows
open index.html          # macOS

# Or serve locally (needed if testing features that require http:// origin)
python3 -m http.server 8000
npx serve .
```

There are no automated tests. Verify changes by opening the game in a browser and playing it (movement, rotation, line clears, scoring, pause, game over/restart).

## Architecture

Everything lives in `game.js` as top-level state and functions (no classes, no modules, no bundler) — all game state is held in module-scope `let` variables (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, etc.), mutated directly by the functions below.

- **Board model**: `board` is a `ROWS × COLS` matrix (20×10). Each cell is `0` (empty) or an integer 1–7 indexing into `COLORS`/`PIECES`, identifying which tetromino occupies it.
- **Pieces**: `PIECES` defines the 7 tetrominoes (I, O, T, S, Z, J, L) as square matrices. `current`/`next` are `{ type, shape, x, y }`. Rotation (`rotateCW`) transposes + reverses rows of the shape matrix — there's no separate rotation-state table (no SRS), just wall kicks tried as offsets `[0, -1, 1, -2, 2]` in `tryRotate`.
- **Collision** (`collide(shape, ox, oy)`): checks board bounds and overlap against already-locked cells in `board`. Used for movement, rotation, gravity, and ghost-piece projection.
- **Game loop** (`loop(ts)`): driven by `requestAnimationFrame`, accumulates elapsed time in `dropAccum` and advances the piece down one row once `dropAccum >= dropInterval`; otherwise calls `lockPiece()`.
- **Locking a piece** (`lockPiece`): `merge()` (writes shape into `board`) → `clearLines()` → `spawn()` (promotes `next` to `current`, generates new `next`; if the new piece immediately collides, calls `endGame()`).
- **Line clearing** (`clearLines`): scans bottom-to-top, splices full rows out and unshifts empty rows at the top. Updates score via `LINE_SCORES` (`[0,100,300,500,800]`) multiplied by `level`, recomputes `level` (`floor(lines/10)+1`) and `dropInterval` (`max(100, 1000 - (level-1)*90)` ms).
- **Scoring**: hard drop = 2 points per cell dropped; soft drop = 1 point per row; line clears per `LINE_SCORES` × level.
- **Ghost piece** (`ghostY`): projects `current` straight down until collision, drawn at `globalAlpha = 0.2` in `draw()`.
- **Rendering**: `draw()` clears and redraws the grid, locked board, ghost piece, and current piece onto `#board` canvas every frame; `drawNext()` renders the next-piece preview onto the separate `#next-canvas`.
- **Input**: a single `keydown` listener switches on `e.code` (arrows, `KeyX` for rotate, `Space` for hard drop, `KeyP` for pause) and is a no-op while `paused` or `gameOver`.
- **HTML/CSS**: `index.html` just declares the two canvases (`#board` 300×600, `#next-canvas` 120×120), the score/lines/level panel, and the pause/game-over `#overlay`. `style.css` provides the dark/retro arcade look; game rendering itself is all Canvas 2D, not DOM/CSS.

## Tunable constants (top of `game.js`)

`COLS`, `ROWS`, `BLOCK` (cell pixel size), `COLORS`, `LINE_SCORES`, initial `dropInterval`. If `COLS`/`ROWS`/`BLOCK` change, update the `#board` canvas `width`/`height` in `index.html` to match (`COLS × BLOCK`, `ROWS × BLOCK`).
