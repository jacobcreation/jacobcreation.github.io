const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const startOverlay = document.getElementById('startOverlay');
const gameOverOverlay = document.getElementById('gameOverOverlay');
const finalScoreEl = document.getElementById('finalScore');
const gameOverTitle = document.getElementById('gameOverTitle');

const TILE = 20;
const COLS = 28;
const ROWS = 31;
canvas.width = COLS * TILE;
canvas.height = ROWS * TILE;

// Map: 0=dot, 1=wall, 2=empty, 3=energizer
const MAP_TEMPLATE = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,1,1,1,1,0,1,1,1,1,1,0,1,1,0,1,1,1,1,1,0,1,1,1,1,0,1],
  [1,3,1,1,1,1,0,1,1,1,1,1,0,1,1,0,1,1,1,1,1,0,1,1,1,1,3,1],
  [1,0,1,1,1,1,0,1,1,1,1,1,0,1,1,0,1,1,1,1,1,0,1,1,1,1,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,1,1,1,1,0,1,1,0,1,1,1,1,1,1,1,1,0,1,1,0,1,1,1,1,0,1],
  [1,0,1,1,1,1,0,1,1,0,1,1,1,1,1,1,1,1,0,1,1,0,1,1,1,1,0,1],
  [1,0,0,0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,0,1,1,1,1,1,0,1,1,0,1,1,1,1,1,0,1,1,1,1,1,1],
  [1,1,1,1,1,1,0,1,1,1,1,1,0,1,1,0,1,1,1,1,1,0,1,1,1,1,1,1],
  [1,1,1,1,1,1,0,1,1,0,0,0,0,0,0,0,0,0,0,1,1,0,1,1,1,1,1,1],
  [1,1,1,1,1,1,0,1,1,0,1,1,1,2,2,1,1,1,0,1,1,0,1,1,1,1,1,1],
  [1,1,1,1,1,1,0,1,1,0,1,2,2,2,2,2,2,1,0,1,1,0,1,1,1,1,1,1],
  [2,2,2,2,2,2,0,0,0,0,1,2,2,2,2,2,2,1,0,0,0,0,2,2,2,2,2,2],
  [1,1,1,1,1,1,0,1,1,0,1,2,2,2,2,2,2,1,0,1,1,0,1,1,1,1,1,1],
  [1,1,1,1,1,1,0,1,1,0,1,1,1,1,1,1,1,1,0,1,1,0,1,1,1,1,1,1],
  [1,1,1,1,1,1,0,1,1,0,0,0,0,0,0,0,0,0,0,1,1,0,1,1,1,1,1,1],
  [1,1,1,1,1,1,0,1,1,0,1,1,1,1,1,1,1,1,0,1,1,0,1,1,1,1,1,1],
  [1,1,1,1,1,1,0,1,1,0,1,1,1,1,1,1,1,1,0,1,1,0,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,1,1,1,1,0,1,1,1,1,1,0,1,1,0,1,1,1,1,1,0,1,1,1,1,0,1],
  [1,0,1,1,1,1,0,1,1,1,1,1,0,1,1,0,1,1,1,1,1,0,1,1,1,1,0,1],
  [1,3,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,3,1],
  [1,1,1,0,1,1,0,1,1,0,1,1,1,1,1,1,1,1,0,1,1,0,1,1,0,1,1,1],
  [1,1,1,0,1,1,0,1,1,0,1,1,1,1,1,1,1,1,0,1,1,0,1,1,0,1,1,1],
  [1,0,0,0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,0,0,1],
  [1,0,1,1,1,1,1,1,1,1,1,1,0,1,1,0,1,1,1,1,1,1,1,1,1,1,0,1],
  [1,0,1,1,1,1,1,1,1,1,1,1,0,1,1,0,1,1,1,1,1,1,1,1,1,1,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

let MAP = [];
const DIRS = {
  up: { x: 0, y: -1, angle: Math.PI * 1.5 },
  down: { x: 0, y: 1, angle: Math.PI * 0.5 },
  left: { x: -1, y: 0, angle: Math.PI },
  right: { x: 1, y: 0, angle: 0 }
};

let score = 0, lives = 3, running = false, level = 1;
let pacman, ghosts = [], frightenedTimer = 0, ghostModeTimer = 0, ghostMode = 'scatter';
let animationId;
let lastTime = 0;
const FPS = 60;
const frameInterval = 1000 / FPS;

class Entity {
  constructor(x, y, speed, color) {
    this.x = x;
    this.y = y;
    this.speed = speed;
    this.dir = 'left';
    this.nextDir = 'left';
    this.radius = TILE / 2 - 2;
    this.color = color;
  }

  getTileX() { return Math.floor(this.x / TILE); }
  getTileY() { return Math.floor(this.y / TILE); }

  snapToCenter() {
    this.x = this.getTileX() * TILE + TILE / 2;
    this.y = this.getTileY() * TILE + TILE / 2;
  }

  isCrossingCenter() {
    const cx = this.getTileX() * TILE + TILE / 2;
    const cy = this.getTileY() * TILE + TILE / 2;
    const dx = DIRS[this.dir].x;
    const dy = DIRS[this.dir].y;

    if (dx !== 0) {
      return (dx > 0 && this.x <= cx && this.x + this.speed >= cx) || 
             (dx < 0 && this.x >= cx && this.x - this.speed <= cx);
    }
    if (dy !== 0) {
      return (dy > 0 && this.y <= cy && this.y + this.speed >= cy) || 
             (dy < 0 && this.y >= cy && this.y - this.speed <= cy);
    }
    return false;
  }
}

class Pacman extends Entity {
  constructor() {
    super(13.5 * TILE, 23 * TILE, 2.0, '#ffff00');
    this.mouth = 0;
    this.mouthOpen = true;
  }

  update() {
    const tx = this.getTileX();
    const ty = this.getTileY();

    // Check for turns or stops at tile center
    if (this.isCrossingCenter()) {
      if (canMove(tx, ty, this.nextDir)) {
        this.snapToCenter();
        this.dir = this.nextDir;
      } else if (!canMove(tx, ty, this.dir)) {
        this.snapToCenter();
        return;
      }
    }

    this.x += DIRS[this.dir].x * this.speed;
    this.y += DIRS[this.dir].y * this.speed;

    // Wrap around
    if (this.x < 0) this.x = canvas.width;
    if (this.x > canvas.width) this.x = 0;

    // Eat items
    const ntx = this.getTileX();
    const nty = this.getTileY();
    if (MAP[nty][ntx] === 0) {
      MAP[nty][ntx] = 2;
      score += 10;
      scoreEl.textContent = score;
    } else if (MAP[nty][ntx] === 3) {
      MAP[nty][ntx] = 2;
      score += 50;
      scoreEl.textContent = score;
      startFrightened();
    }

    // Mouth animation
    if (this.mouthOpen) this.mouth += 0.1;
    else this.mouth -= 0.1;
    if (this.mouth >= 0.4 || this.mouth <= 0) this.mouthOpen = !this.mouthOpen;
  }

  draw() {
    const angle = DIRS[this.dir].angle;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.arc(this.x, this.y, this.radius + 2, angle + this.mouth, angle + Math.PI * 2 - this.mouth);
    ctx.lineTo(this.x, this.y);
    ctx.fill();
  }
}

class Ghost extends Entity {
  constructor(x, y, color, name, scatterTarget, houseDelay) {
    super(x * TILE + TILE/2, y * TILE + TILE/2, 1.8, color);
    this.startX = x * TILE + TILE/2;
    this.startY = y * TILE + TILE/2;
    this.name = name;
    this.scatterTarget = scatterTarget;
    this.state = 'house';
    this.houseDelay = houseDelay;
    this.timer = 0;
    this.dir = 'up';
  }

  update() {
    if (this.state === 'house') {
      this.timer++;
      this.y += Math.sin(this.timer * 0.1) * 0.5;
      if (this.timer > this.houseDelay) this.state = 'exiting';
      return;
    }

    if (this.state === 'exiting') {
      const targetX = 13.5 * TILE;
      const targetY = 11 * TILE + TILE/2;
      const dx = targetX - this.x;
      const dy = targetY - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist < this.speed) {
        this.x = targetX; this.y = targetY;
        this.state = 'active'; this.dir = 'left';
      } else {
        this.x += (dx / dist) * this.speed;
        this.y += (dy / dist) * this.speed;
      }
      return;
    }

    if (this.state === 'eaten') {
      const targetX = 13.5 * TILE;
      const targetY = 14 * TILE + TILE/2;
      const dx = targetX - this.x;
      const dy = targetY - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 5) { this.state = 'exiting'; this.speed = 1.8; }
      else { this.x += (dx/dist) * 5; this.y += (dy/dist) * 5; }
      return;
    }

    if (this.isCrossingCenter()) {
      this.snapToCenter();
      const possibleDirs = ['up', 'down', 'left', 'right'].filter(d => {
        if (d === getOppositeDir(this.dir)) return false;
        return canMove(this.getTileX(), this.getTileY(), d);
      });

      if (possibleDirs.length > 0) {
        const target = this.getTarget();
        let bestDir = possibleDirs[0];
        let minDist = Infinity;
        
        possibleDirs.forEach(d => {
          const nx = this.getTileX() + DIRS[d].x;
          const ny = this.getTileY() + DIRS[d].y;
          const dist = Math.hypot(nx - target.x, ny - target.y);
          if (dist < minDist) { minDist = dist; bestDir = d; }
        });
        
        if (this.state === 'frightened') {
          bestDir = possibleDirs[Math.floor(Math.random() * possibleDirs.length)];
        }
        this.dir = bestDir;
      }
    }

    const s = this.state === 'frightened' ? this.speed * 0.6 : this.speed;
    this.x += DIRS[this.dir].x * s;
    this.y += DIRS[this.dir].y * s;

    if (this.x < 0) this.x = canvas.width;
    if (this.x > canvas.width) this.x = 0;

    const dist = Math.hypot(this.x - pacman.x, this.y - pacman.y);
    if (dist < TILE * 0.8) {
      if (this.state === 'frightened') {
        this.state = 'eaten';
        this.speed = 4;
        score += 200;
        scoreEl.textContent = score;
      } else if (this.state === 'active') {
        die();
      }
    }
  }

  getTarget() {
    if (this.state === 'frightened') return { x: Math.random() * COLS, y: Math.random() * ROWS };
    if (ghostMode === 'scatter') return this.scatterTarget;
    
    // Chase logic
    switch(this.name) {
      case 'Blinky': return { x: pacman.getTileX(), y: pacman.getTileY() };
      case 'Pinky': return { 
        x: pacman.getTileX() + DIRS[pacman.dir].x * 4, 
        y: pacman.getTileY() + DIRS[pacman.dir].y * 4 
      };
      case 'Inky': {
        const bx = ghosts[0].getTileX();
        const by = ghosts[0].getTileY();
        const tx = pacman.getTileX() + DIRS[pacman.dir].x * 2;
        const ty = pacman.getTileY() + DIRS[pacman.dir].y * 2;
        return { x: tx + (tx - bx), y: ty + (ty - by) };
      }
      case 'Clyde': {
        const dist = Math.hypot(this.getTileX() - pacman.getTileX(), this.getTileY() - pacman.getTileY());
        return dist > 8 ? { x: pacman.getTileX(), y: pacman.getTileY() } : this.scatterTarget;
      }
    }
    return { x: 0, y: 0 };
  }

  draw() {
    const r = this.radius + 2;
    ctx.fillStyle = this.state === 'frightened' ? (frightenedTimer < 100 && Math.floor(frightenedTimer/10)%2 ? '#fff' : '#2121ff') : (this.state === 'eaten' ? 'rgba(255,255,255,0.2)' : this.color);
    
    if (this.state !== 'eaten') {
        ctx.beginPath();
        ctx.arc(this.x, this.y - 2, r, Math.PI, 0, false);
        ctx.lineTo(this.x + r, this.y + r);
        for (let i = 0; i < 3; i++) {
            const bx = this.x + r - (i * 2 + 1) * (r * 2 / 6);
            ctx.quadraticCurveTo(bx, this.y + r + 4, bx - r * 2 / 6, this.y + r);
        }
        ctx.closePath();
        ctx.fill();
    }

    // Eyes
    if (this.state !== 'frightened' || this.state === 'eaten') {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(this.x - 4, this.y - 4, 3, 4, 0, 0, Math.PI * 2);
      ctx.ellipse(this.x + 4, this.y - 4, 3, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000';
      const ex = DIRS[this.dir].x * 2;
      const ey = DIRS[this.dir].y * 2;
      ctx.beginPath();
      ctx.arc(this.x - 4 + ex, this.y - 4 + ey, 1.5, 0, Math.PI * 2);
      ctx.arc(this.x + 4 + ex, this.y - 4 + ey, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function canMove(tx, ty, dir) {
  const nx = tx + DIRS[dir].x;
  const ny = ty + DIRS[dir].y;
  if (nx < 0 || nx >= COLS) return true; // Allow wrap around
  if (ny < 0 || ny >= ROWS) return false;
  return MAP[ny][nx] !== 1;
}

function getOppositeDir(dir) {
  const opp = { up: 'down', down: 'up', left: 'right', right: 'left' };
  return opp[dir];
}

function initGame() {
  MAP = MAP_TEMPLATE.map(row => [...row]);
  score = 0;
  lives = 3;
  level = 1;
  scoreEl.textContent = score;
  livesEl.textContent = lives;
  resetLevel();
}

function resetLevel() {
  pacman = new Pacman();
  ghosts = [
    new Ghost(13.5, 11, '#ff0000', 'Blinky', { x: 25, y: -2 }, 0),
    new Ghost(13.5, 14, '#ffb8ff', 'Pinky', { x: 2, y: -2 }, 60),
    new Ghost(11.5, 14, '#00ffff', 'Inky', { x: 27, y: 31 }, 180),
    new Ghost(15.5, 14, '#ffb852', 'Clyde', { x: 0, y: 31 }, 300)
  ];
  frightenedTimer = 0;
  ghostModeTimer = 0;
  ghostMode = 'scatter';
}

function startFrightened() {
  frightenedTimer = 420; // 7 seconds at 60fps
  ghosts.forEach(g => {
    if (g.state === 'active') g.state = 'frightened';
  });
}

function die() {
  lives--;
  livesEl.textContent = lives;
  running = false;
  if (lives <= 0) {
    showGameOver(false);
  } else {
    setTimeout(() => {
      resetLevel();
      running = true;
    }, 1000);
  }
}

function showGameOver(win) {
  running = false;
  cancelAnimationFrame(animationId);
  gameOverOverlay.style.display = 'block';
  gameOverTitle.textContent = win ? "YOU WIN!" : "GAME OVER";
  gameOverTitle.style.color = win ? "#0f0" : "#f00";
  finalScoreEl.textContent = score;
}

function update() {
  if (!running) return;

  pacman.update();
  ghosts.forEach(g => g.update());

  // Timers
  if (frightenedTimer > 0) {
    frightenedTimer--;
    if (frightenedTimer === 0) {
      ghosts.forEach(g => { if (g.state === 'frightened') g.state = 'active'; });
    }
  }

  ghostModeTimer++;
  if (ghostModeTimer > 1200) { // Switch every 20s
    ghostMode = ghostMode === 'scatter' ? 'chase' : 'scatter';
    ghostModeTimer = 0;
  }

  // Check win
  const dots = MAP.flat().filter(t => t === 0 || t === 3).length;
  if (dots === 0) {
    showGameOver(true);
  }
}

function draw(time) {
  if (!lastTime) lastTime = time;
  const delta = time - lastTime;

  if (delta >= frameInterval) {
    lastTime = time - (delta % frameInterval);

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Maze
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const t = MAP[r][c];
        if (t === 1) {
          ctx.strokeStyle = '#2121de';
          ctx.lineWidth = 2;
          ctx.strokeRect(c * TILE + 2, r * TILE + 2, TILE - 4, TILE - 4);
        } else if (t === 0) {
          ctx.fillStyle = '#ffb8ae';
          ctx.beginPath();
          ctx.arc(c * TILE + TILE / 2, r * TILE + TILE / 2, 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (t === 3) {
          if (Math.floor(Date.now() / 200) % 2) {
            ctx.fillStyle = '#ffb8ae';
            ctx.beginPath();
            ctx.arc(c * TILE + TILE / 2, r * TILE + TILE / 2, 6, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    ghosts.forEach(g => g.draw());
    pacman.draw();
    update();
  }
  animationId = requestAnimationFrame(draw);
}

// Controls
function handleInput(dir) {
  if (!running) return;
  pacman.nextDir = dir;
}

window.addEventListener('keydown', e => {
  const keys = {
    ArrowUp: 'up', w: 'up',
    ArrowDown: 'down', s: 'down',
    ArrowLeft: 'left', a: 'left',
    ArrowRight: 'right', d: 'right'
  };
  if (keys[e.key]) {
    handleInput(keys[e.key]);
    e.preventDefault();
  }
});

// Touch & Mobile
let touchStart = null;
canvas.addEventListener('touchstart', e => {
  touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  if (!touchStart) return;
  const dx = e.touches[0].clientX - touchStart.x;
  const dy = e.touches[0].clientY - touchStart.y;
  if (Math.abs(dx) > 20 || Math.abs(dy) > 20) {
    if (Math.abs(dx) > Math.abs(dy)) handleInput(dx > 0 ? 'right' : 'left');
    else handleInput(dy > 0 ? 'down' : 'up');
    touchStart = null;
  }
  e.preventDefault();
}, { passive: false });

document.querySelectorAll('.control-btn').forEach(btn => {
  btn.addEventListener('touchstart', e => {
    handleInput(btn.dataset.dir);
    e.preventDefault();
  });
  btn.addEventListener('mousedown', () => handleInput(btn.dataset.dir));
});

document.getElementById('startBtn').addEventListener('click', () => {
  startOverlay.style.display = 'none';
  initGame();
  running = true;
  draw();
});

document.getElementById('restartBtn').addEventListener('click', () => {
  gameOverOverlay.style.display = 'none';
  initGame();
  running = true;
});

// Initial Maze Draw
MAP = MAP_TEMPLATE.map(row => [...row]);
pacman = new Pacman();
ghosts = [
  new Ghost(13.5, 11, '#ff0000', 'Blinky', { x: 25, y: -2 }, 0),
  new Ghost(13.5, 14, '#ffb8ff', 'Pinky', { x: 2, y: -2 }, 60),
  new Ghost(11.5, 14, '#00ffff', 'Inky', { x: 27, y: 31 }, 180),
  new Ghost(15.5, 14, '#ffb852', 'Clyde', { x: 0, y: 31 }, 300)
];
draw();
running = false;
