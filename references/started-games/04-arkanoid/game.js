const canvas = document.getElementById( 'gameCanvas' );
const ctx = canvas.getContext( '2d' );

const paddle = {
  x: ( canvas.width - 162 ) / 2,
  y: 550,
  width: 162,
  height: 14,
  speed: 7,
};

const ball = {
  x: canvas.width / 2,
  y: paddle.y - 8,
  radius: 8,
  dx: 4,
  dy: -4,
};

function resetPaddleAndBall() {
  paddle.x = ( canvas.width - paddle.width ) / 2;
  ball.x = canvas.width / 2;
  ball.y = paddle.y - 8;
  ball.dx = 4;
  ball.dy = -4;
}

let lives = 3;
let score = 0;

const BLOCK_COLS = 10;
const BLOCK_ROWS = 5;
const BLOCK_WIDTH = 76;
const BLOCK_HEIGHT = 24;
const BLOCK_PADDING = 4;
const BLOCK_OFFSET_TOP = 50;
const BLOCK_OFFSET_LEFT = ( canvas.width - ( BLOCK_COLS * ( BLOCK_WIDTH + BLOCK_PADDING ) - BLOCK_PADDING ) ) / 2;
const ROW_COLORS = [ 'red', 'yellow', 'green', 'cyan', 'magenta' ];

const LEVELS = [
  // Nivel 1: grilla completa.
  [
    [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 1 ],
    [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 1 ],
    [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 1 ],
    [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 1 ],
    [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 1 ],
  ],
  // Nivel 2: filas alternadas con huecos cada 3 columnas.
  [
    [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 1 ],
    [ 1, 1, 0, 1, 1, 0, 1, 1, 0, 1 ],
    [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 1 ],
    [ 1, 1, 0, 1, 1, 0, 1, 1, 0, 1 ],
    [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 1 ],
  ],
  // Nivel 3: pirámide (angosta arriba, ancha abajo).
  [
    [ 0, 0, 0, 0, 1, 1, 0, 0, 0, 0 ],
    [ 0, 0, 0, 1, 1, 1, 1, 0, 0, 0 ],
    [ 0, 0, 1, 1, 1, 1, 1, 1, 0, 0 ],
    [ 0, 1, 1, 1, 1, 1, 1, 1, 1, 0 ],
    [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 1 ],
  ],
  // Nivel 4: diamante.
  [
    [ 0, 0, 0, 1, 1, 1, 1, 0, 0, 0 ],
    [ 0, 1, 1, 1, 1, 1, 1, 1, 1, 0 ],
    [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 1 ],
    [ 0, 1, 1, 1, 1, 1, 1, 1, 1, 0 ],
    [ 0, 0, 0, 1, 1, 1, 1, 0, 0, 0 ],
  ],
  // Nivel 5: marco hueco.
  [
    [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 1 ],
    [ 1, 0, 0, 0, 0, 0, 0, 0, 0, 1 ],
    [ 1, 0, 0, 0, 0, 0, 0, 0, 0, 1 ],
    [ 1, 0, 0, 0, 0, 0, 0, 0, 0, 1 ],
    [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 1 ],
  ],
];

let currentLevel = 0;

function createBlocks() {
  const blocks = [];
  const pattern = LEVELS[ currentLevel ];
  for ( let row = 0; row < BLOCK_ROWS; row++ ) {
    for ( let col = 0; col < BLOCK_COLS; col++ ) {
      if ( pattern[ row ][ col ] === 0 ) continue;
      blocks.push( {
        x: BLOCK_OFFSET_LEFT + col * ( BLOCK_WIDTH + BLOCK_PADDING ),
        y: BLOCK_OFFSET_TOP + row * ( BLOCK_HEIGHT + BLOCK_PADDING ),
        width: BLOCK_WIDTH,
        height: BLOCK_HEIGHT,
        color: ROW_COLORS[ row ],
        destroyed: false,
      } );
    }
  }
  return blocks;
}

let blocks = createBlocks();

let explosions = [];

function spawnExplosion( block ) {
  explosions.push( {
    x: block.x,
    y: block.y,
    width: block.width,
    height: block.height,
    color: block.color,
    startTime: performance.now(),
  } );
}

let gameState = 'playing';

const sounds = {
  bounce: new Audio( 'assets/sounds/ball-bounce.mp3' ),
  destroy: new Audio( 'assets/sounds/break-sound.mp3' ),
};

let volume = 1.0;

function playSound( sound ) {
  sound.currentTime = 0;
  sound.volume = volume;
  sound.play();
}

const keys = {};

let paused = false;

function resetGame() {
  lives = 3;
  score = 0;
  currentLevel = 0;
  blocks = createBlocks();
  explosions = [];
  resetPaddleAndBall();
  gameState = 'playing';
}

function advanceLevel() {
  currentLevel++;
  blocks = createBlocks();
  explosions = [];
  resetPaddleAndBall();
  playSound( sounds.bounce );
  gameState = 'playing';
}

document.addEventListener( 'keydown', ( e ) => {
  keys[ e.key ] = true;

  if ( ( gameState === 'won' || gameState === 'lost' ) && ( e.key === 'r' || e.key === 'R' ) ) {
    resetGame();
  }

  if ( gameState === 'levelComplete' && e.key === ' ' ) {
    advanceLevel();
  }

  if ( e.key === '+' || e.key === '=' ) {
    volume = Math.min( 1, Math.round( ( volume + 0.1 ) * 10 ) / 10 );
  } else if ( e.key === '-' ) {
    volume = Math.max( 0, Math.round( ( volume - 0.1 ) * 10 ) / 10 );
  }

  if ( ( e.key === 'p' || e.key === 'P' ) && gameState === 'playing' ) {
    paused = !paused;
    playSound( sounds.bounce );
  }

  if ( '12345'.includes( e.key ) && gameState === 'playing' ) {
    currentLevel = Number( e.key ) - 1;
    lives = 3;
    score = 0;
    blocks = createBlocks();
    explosions = [];
    resetPaddleAndBall();
  }
} );

document.addEventListener( 'keyup', ( e ) => {
  keys[ e.key ] = false;
} );

function update() {
  if ( keys[ 'ArrowLeft' ] ) {
    paddle.x -= paddle.speed;
  }
  if ( keys[ 'ArrowRight' ] ) {
    paddle.x += paddle.speed;
  }

  if ( paddle.x < 0 ) paddle.x = 0;
  if ( paddle.x + paddle.width > canvas.width ) paddle.x = canvas.width - paddle.width;

  ball.x += ball.dx;
  ball.y += ball.dy;

  if ( ball.x - ball.radius < 0 ) {
    ball.x = ball.radius;
    ball.dx = -ball.dx;
    playSound( sounds.bounce );
  } else if ( ball.x + ball.radius > canvas.width ) {
    ball.x = canvas.width - ball.radius;
    ball.dx = -ball.dx;
    playSound( sounds.bounce );
  }

  if ( ball.y - ball.radius < 0 ) {
    ball.y = ball.radius;
    ball.dy = -ball.dy;
    playSound( sounds.bounce );
  }

  const hitsPaddle =
    ball.dy > 0 &&
    ball.y + ball.radius >= paddle.y &&
    ball.y + ball.radius <= paddle.y + paddle.height &&
    ball.x >= paddle.x &&
    ball.x <= paddle.x + paddle.width;

  if ( hitsPaddle ) {
    ball.y = paddle.y - ball.radius;
    ball.dy = -ball.dy;
    playSound( sounds.bounce );
  }

  for ( const block of blocks ) {
    if ( block.destroyed ) continue;

    const closestX = Math.max( block.x, Math.min( ball.x, block.x + block.width ) );
    const closestY = Math.max( block.y, Math.min( ball.y, block.y + block.height ) );
    const dx = ball.x - closestX;
    const dy = ball.y - closestY;

    if ( dx * dx + dy * dy <= ball.radius * ball.radius ) {
      block.destroyed = true;
      score += 10;
      spawnExplosion( block );
      playSound( sounds.destroy );
      if ( Math.abs( dx ) > Math.abs( dy ) ) {
        ball.dx = -ball.dx;
      } else {
        ball.dy = -ball.dy;
      }
      break;
    }
  }

  if ( ball.y - ball.radius > canvas.height ) {
    lives--;
    playSound( sounds.destroy );
    if ( lives > 0 ) {
      resetPaddleAndBall();
    } else {
      gameState = 'lost';
    }
  }

  if ( blocks.every( ( block ) => block.destroyed ) ) {
    gameState = currentLevel < LEVELS.length - 1 ? 'levelComplete' : 'won';
    playSound( sounds.bounce );
  }

  explosions = explosions.filter( ( exp ) => performance.now() - exp.startTime < EXPLOSION_DURATION );
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect( 0, 0, canvas.width, canvas.height );
  drawSprite( ctx, 'paddle', paddle.x, paddle.y, paddle.width, paddle.height );
  drawSprite( ctx, 'ball', ball.x - ball.radius, ball.y - ball.radius, ball.radius * 2, ball.radius * 2 );

  for ( const block of blocks ) {
    if ( block.destroyed ) continue;
    drawSprite( ctx, `block_${ block.color }`, block.x, block.y, block.width, block.height );
  }

  for ( const exp of explosions ) {
    const frames = EXPLOSION_FRAMES[ exp.color ];
    const elapsed = performance.now() - exp.startTime;
    const frameIndex = Math.min( frames.length - 1, Math.floor( elapsed / ( EXPLOSION_DURATION / frames.length ) ) );
    drawFrame( ctx, frames[ frameIndex ], exp.x, exp.y, exp.width, exp.height );
  }

  ctx.fillStyle = '#fff';
  ctx.font = '20px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText( `Score: ${ score }`, 10, 25 );
  ctx.fillText( `Nivel: ${ currentLevel + 1 }`, 10, 45 );

  const LIFE_ICON_SIZE = 16;
  const LIFE_ICON_GAP = 8;
  for ( let i = 0; i < lives; i++ ) {
    const iconX = canvas.width - 10 - LIFE_ICON_SIZE - i * ( LIFE_ICON_SIZE + LIFE_ICON_GAP );
    drawSprite( ctx, 'ball', iconX, 10, LIFE_ICON_SIZE, LIFE_ICON_SIZE );
  }

  if ( gameState === 'won' || gameState === 'lost' ) {
    const message = gameState === 'won' ? '¡Completaste todos los niveles!' : 'Perdiste';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect( 0, 0, canvas.width, canvas.height );
    ctx.fillStyle = '#fff';
    ctx.font = '48px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText( message, canvas.width / 2, canvas.height / 2 - 20 );
    ctx.font = '24px sans-serif';
    ctx.fillText( 'Presiona R para reiniciar', canvas.width / 2, canvas.height / 2 + 30 );
  }

  if ( gameState === 'levelComplete' ) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect( 0, 0, canvas.width, canvas.height );
    ctx.fillStyle = '#fff';
    ctx.font = '48px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText( `Nivel ${ currentLevel + 1 } completado`, canvas.width / 2, canvas.height / 2 - 20 );
    ctx.font = '24px sans-serif';
    ctx.fillText( 'Presiona ESPACIO para continuar', canvas.width / 2, canvas.height / 2 + 30 );
  }

  if ( gameState === 'playing' && paused ) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect( 0, 0, canvas.width, canvas.height );
    ctx.fillStyle = '#fff';
    ctx.font = '48px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText( 'Pausa', canvas.width / 2, canvas.height / 2 - 20 );
    ctx.font = '20px sans-serif';
    ctx.fillText( 'Presiona 1-5 para elegir nivel', canvas.width / 2, canvas.height / 2 + 20 );
  }
}

function loop() {
  if ( gameState === 'playing' && !paused ) {
    update();
  }
  draw();
  requestAnimationFrame( loop );
}

loadSpritesheet( () => {
  loop();
} );
