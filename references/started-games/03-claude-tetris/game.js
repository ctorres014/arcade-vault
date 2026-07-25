'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#64b5f6', // J - pale blue
  '#ffb74d', // L - orange
  '#90a4ae', // tuerca - gris metálico
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // tuerca (hueca)
];

const PASTEL_COLORS = [
  null,
  '#a7d8de', // I
  '#fff3b0', // O
  '#d8b4e2', // T
  '#b8e0c4', // S
  '#f2b8b5', // Z
  '#b3d4f2', // J
  '#f7cfa3', // L
  '#c9d1d9', // tuerca
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const SKINS = {
  retro: { palette: COLORS },
  neon: { palette: COLORS, glow: true },
  pastel: { palette: PASTEL_COLORS, rounded: true },
  pixel: { palette: COLORS, texture: true },
};
const SKIN_NAMES = Object.keys(SKINS);

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const comboEl = document.getElementById('combo');
const bestComboEl = document.getElementById('best-combo');
const bestLinesEl = document.getElementById('best-lines');
const scoreboardListEl = document.getElementById('scoreboard-list');
const overlayScoreboardListEl = document.getElementById('overlay-scoreboard-list');
const resetScoresBtn = document.getElementById('reset-scores-btn');
const nameEntry = document.getElementById('name-entry');
const nameInput = document.getElementById('name-input');
const nameSubmitBtn = document.getElementById('name-submit-btn');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');
const skinSelect = document.getElementById('skin-select');
const gameoverBox = document.getElementById('gameover-box');
const pauseBox = document.getElementById('pause-box');
const resumeBtn = document.getElementById('resume-btn');
const restartPauseBtn = document.getElementById('restart-pause-btn');
const levelSelect = document.getElementById('level-select');

const THEME_KEY = 'tetris-theme';
const SKIN_KEY = 'tetris-skin';
const RECORDS_KEY = 'tetris-records';
const MAX_INITIAL_LEVEL = 10;

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let gridLineColor;
let activeSkin = 'retro';
let combo;
let records;
let pendingScore = null;
let initialLevel = 1;

function populateLevelSelect() {
  for (let i = 1; i <= MAX_INITIAL_LEVEL; i++) {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = String(i);
    levelSelect.appendChild(opt);
  }
  levelSelect.value = String(initialLevel);
}

levelSelect.addEventListener('change', () => {
  const value = parseInt(levelSelect.value, 10);
  if (!Number.isNaN(value) && value >= 1 && value <= MAX_INITIAL_LEVEL) {
    initialLevel = value;
  }
});

function defaultRecords() {
  return { scores: [], bestCombo: 0, bestLines: 0 };
}

function loadRecords() {
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    if (!raw) return defaultRecords();
    const parsed = JSON.parse(raw);
    return {
      scores: Array.isArray(parsed.scores) ? parsed.scores : [],
      bestCombo: Number(parsed.bestCombo) || 0,
      bestLines: Number(parsed.bestLines) || 0,
    };
  } catch (e) {
    // localStorage puede no estar disponible (navegación privada, file://, etc.)
    return defaultRecords();
  }
}

function saveRecords() {
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  } catch (e) {
    // si falla la persistencia, el juego debe seguir funcionando igual
  }
}

function qualifiesForTop5(candidateScore) {
  if (candidateScore <= 0) return false;
  if (records.scores.length < 5) return true;
  const sorted = [...records.scores].sort((a, b) => b.score - a.score);
  return candidateScore > sorted[sorted.length - 1].score;
}

function renderScoreboard(listEl, highlightIndex) {
  if (!listEl) return;
  listEl.innerHTML = '';
  if (!records.scores.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'Sin puntajes aún';
    listEl.appendChild(li);
    return;
  }
  records.scores.forEach((entry, i) => {
    const li = document.createElement('li');
    if (i === highlightIndex) li.classList.add('highlight');
    const rank = document.createElement('span');
    rank.className = 'sb-rank';
    rank.textContent = `${i + 1}.`;
    const name = document.createElement('span');
    name.className = 'sb-name';
    name.textContent = entry.name;
    const scoreSpan = document.createElement('span');
    scoreSpan.className = 'sb-score';
    scoreSpan.textContent = entry.score.toLocaleString();
    li.appendChild(rank);
    li.appendChild(name);
    li.appendChild(scoreSpan);
    listEl.appendChild(li);
  });
}

function renderAllScoreboards(highlightIndex) {
  renderScoreboard(scoreboardListEl, -1);
  renderScoreboard(overlayScoreboardListEl, highlightIndex ?? -1);
}

function updateBestStatsDisplay() {
  bestComboEl.textContent = records.bestCombo;
  bestLinesEl.textContent = records.bestLines;
}

function submitName() {
  if (pendingScore == null) return;
  let name = (nameInput.value || '').trim();
  if (!name) name = 'AAA';
  name = name.slice(0, 10);
  records.scores.push({ name, score: pendingScore });
  records.scores.sort((a, b) => b.score - a.score);
  records.scores = records.scores.slice(0, 5);
  saveRecords();
  const highlightIndex = records.scores.findIndex(
    e => e.name === name && e.score === pendingScore
  );
  pendingScore = null;
  nameEntry.classList.add('hidden');
  renderAllScoreboards(highlightIndex);
}

resetScoresBtn.addEventListener('click', () => {
  const ok = confirm('¿Seguro que querés borrar el Top 5 y las mejores marcas (combo y líneas)? Esta acción no se puede deshacer.');
  if (!ok) return;
  records = defaultRecords();
  saveRecords();
  updateBestStatsDisplay();
  renderAllScoreboards(-1);
});

nameSubmitBtn.addEventListener('click', submitName);
nameInput.addEventListener('keydown', e => {
  if (e.code === 'Enter') submitName();
});

function updateThemeColors() {
  gridLineColor = getComputedStyle(document.body).getPropertyValue('--color-grid-line').trim();
}

function applyTheme(theme) {
  document.body.classList.toggle('light-theme', theme === 'light');
  themeToggle.checked = theme === 'light';
  updateThemeColors();
}

function initTheme() {
  let stored = 'dark';
  try {
    stored = localStorage.getItem(THEME_KEY) || 'dark';
  } catch (e) {
    // localStorage puede no estar disponible (navegación privada, file://, etc.)
  }
  applyTheme(stored);
}

themeToggle.addEventListener('change', () => {
  const theme = themeToggle.checked ? 'light' : 'dark';
  applyTheme(theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (e) {
    // si falla la persistencia, el tema igual debe aplicarse visualmente
  }
  if (paused || gameOver) draw();
});

function applySkin(skin) {
  if (!SKINS[skin]) skin = 'retro';
  activeSkin = skin;
  SKIN_NAMES.forEach(name => document.body.classList.toggle(`skin-${name}`, name === skin));
  if (skinSelect) skinSelect.value = skin;
  updateThemeColors();
  if (current) draw();
}

function initSkin() {
  let stored = 'retro';
  try {
    stored = localStorage.getItem(SKIN_KEY) || 'retro';
  } catch (e) {
    // localStorage puede no estar disponible (navegación privada, file://, etc.)
  }
  applySkin(stored);
}

skinSelect.addEventListener('change', () => {
  applySkin(skinSelect.value);
  try {
    localStorage.setItem(SKIN_KEY, activeSkin);
  } catch (e) {
    // si falla la persistencia, el skin igual debe aplicarse visualmente
  }
});

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 8) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    combo++;
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    let recordsChanged = false;
    if (combo > records.bestCombo) {
      records.bestCombo = combo;
      recordsChanged = true;
    }
    if (cleared > records.bestLines) {
      records.bestLines = cleared;
      recordsChanged = true;
    }
    if (recordsChanged) {
      saveRecords();
      updateBestStatsDisplay();
    }
  } else {
    combo = 0;
  }
  updateHUD();
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
  comboEl.textContent = combo;
}

function roundedRectPath(context, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

function drawPixelTexture(context, x, y, s) {
  const step = Math.max(4, Math.floor(s / 5));
  context.fillStyle = 'rgba(0,0,0,0.18)';
  for (let iy = 0; iy < s; iy += step) {
    for (let ix = 0; ix < s; ix += step) {
      if (((ix / step) + (iy / step)) % 2 === 0) {
        const w = Math.min(step - 1, s - ix);
        const h = Math.min(step - 1, s - iy);
        if (w > 0 && h > 0) context.fillRect(x + ix, y + iy, w, h);
      }
    }
  }
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const skin = SKINS[activeSkin] || SKINS.retro;
  const color = skin.palette[colorIndex] || COLORS[colorIndex];
  const px = x * size + 1;
  const py = y * size + 1;
  const s = size - 2;

  context.save();
  context.globalAlpha = alpha ?? 1;
  if (skin.glow) {
    context.shadowBlur = size * 0.6;
    context.shadowColor = color;
  }
  context.fillStyle = color;
  if (skin.rounded) {
    roundedRectPath(context, px, py, s, s, 6);
    context.fill();
  } else {
    context.fillRect(px, py, s, s);
  }

  // highlight
  context.shadowBlur = 0;
  context.fillStyle = 'rgba(255,255,255,0.12)';
  if (skin.rounded) {
    roundedRectPath(context, px, py, s, Math.min(4, s), 6);
    context.fill();
  } else {
    context.fillRect(px, py, s, 4);
  }

  if (skin.texture) {
    drawPixelTexture(context, px, py, s);
  }

  context.restore();
}

function drawGrid() {
  ctx.strokeStyle = gridLineColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  gameoverBox.classList.remove('hidden');
  pauseBox.classList.add('hidden');
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlayScoreboardListEl.classList.remove('hidden');
  if (qualifiesForTop5(score)) {
    pendingScore = score;
    nameEntry.classList.remove('hidden');
    renderAllScoreboards(-1);
    nameInput.value = '';
    overlay.classList.remove('hidden');
    setTimeout(() => nameInput.focus(), 0);
  } else {
    pendingScore = null;
    nameEntry.classList.add('hidden');
    renderAllScoreboards(-1);
    overlay.classList.remove('hidden');
  }
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    overlay.classList.add('hidden');
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    nameEntry.classList.add('hidden');
    overlayScoreboardListEl.classList.add('hidden');
    gameoverBox.classList.add('hidden');
    pauseBox.classList.remove('hidden');
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  if (pendingScore != null) submitName();
  board = createBoard();
  score = 0;
  lines = 0;
  level = initialLevel;
  combo = 0;
  pendingScore = null;
  paused = false;
  gameOver = false;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  nameEntry.classList.add('hidden');
  overlay.classList.add('hidden');
  gameoverBox.classList.remove('hidden');
  pauseBox.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);
resumeBtn.addEventListener('click', () => {
  if (paused) togglePause();
});
restartPauseBtn.addEventListener('click', init);

populateLevelSelect();
initTheme();
initSkin();
records = loadRecords();
updateBestStatsDisplay();
renderAllScoreboards(-1);
init();
