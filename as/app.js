const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const W = canvas.width = 960;
const H = canvas.height = 640;

// Utility functions (need to be defined early)
const wrap = (v, max) => ((v % max) + max) % max;

class Vec {
  constructor(x, y) { this.x = x; this.y = y; }
  add(v) { return new Vec(this.x + v.x, this.y + v.y); }
  sub(v) { return new Vec(this.x - v.x, this.y - v.y); }
  mul(s) { return new Vec(this.x * s, this.y * s); }
  len() { return Math.hypot(this.x, this.y); }
  normalize() { const l = this.len(); return l ? this.mul(1/l) : new Vec(0,0); }
  static fromAngle(a) { return new Vec(Math.cos(a), Math.sin(a)); }
}

const shootBtn = document.getElementById('shoot-btn');
const thrustBtn = document.getElementById('thrust-btn');
const mobileControls = document.getElementById('mobile-controls');

// --- Detect mobile / touch support ---
let isTouchDevice = false;
function showMobileUI() {
  isTouchDevice = true;
  shootBtn.style.display = 'flex';
  thrustBtn.style.display = 'flex';
  mobileControls.style.display = 'block';
}

// --- Keyboard ---
const KEY = {};
window.addEventListener('keydown', e => {
  KEY[e.code] = true;
  if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.code === 'Enter' && gameOver) initGame();
});
window.addEventListener('keyup', e => { KEY[e.code] = false; });

// --- Pointer (mouse + touch) ---
let pointerPos = new Vec(W/2, H/2);
let pointerActive = false;
let touchThrust = false;
let tapStartTime = 0;
let tapStartPos = null;

function canvasCoords(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return new Vec(
    (clientX - rect.left) * (W / rect.width),
    (clientY - rect.top) * (H / rect.height)
  );
}

// Mouse
canvas.addEventListener('mousemove', e => {
  pointerPos = canvasCoords(e.clientX, e.clientY);
  pointerActive = true;
});
canvas.addEventListener('mouseleave', () => {
  pointerActive = false;
});
canvas.addEventListener('click', e => {
  if (!gameOver) shoot();
});

// Touch
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  if (!isTouchDevice) showMobileUI();
  const t = e.changedTouches[0];
  pointerPos = canvasCoords(t.clientX, t.clientY);
  pointerActive = true;
  touchThrust = true;
  tapStartTime = performance.now();
  tapStartPos = { x: t.clientX, y: t.clientY };
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  const t = e.changedTouches[0];
  pointerPos = canvasCoords(t.clientX, t.clientY);
  pointerActive = true;
  // If finger moved far, it's not a tap
  if (tapStartPos) {
    const dx = t.clientX - tapStartPos.x;
    const dy = t.clientY - tapStartPos.y;
    if (Math.hypot(dx, dy) > 15) tapStartTime = 0;
  }
}, { passive: false });

canvas.addEventListener('touchend', e => {
  e.preventDefault();
  touchThrust = false;
  if (tapStartTime && performance.now() - tapStartTime < 200) {
    shoot();
  }
  tapStartTime = 0;
  tapStartPos = null;
  pointerActive = false;
}, { passive: false });

canvas.addEventListener('touchcancel', e => {
  touchThrust = false;
  tapStartTime = 0;
  tapStartPos = null;
  pointerActive = false;
});

// Shoot button
shootBtn.addEventListener('touchstart', e => {
  e.preventDefault();
  e.stopPropagation();
  shootBtn.classList.add('active');
  if (!gameOver) shoot();
}, { passive: false });
shootBtn.addEventListener('touchend', e => {
  e.preventDefault();
  shootBtn.classList.remove('active');
}, { passive: false });
shootBtn.addEventListener('mousedown', e => {
  if (isTouchDevice) return;
  shootBtn.classList.add('active');
  if (!gameOver) shoot();
});
shootBtn.addEventListener('mouseup', () => shootBtn.classList.remove('active'));

// Thrust button
thrustBtn.addEventListener('touchstart', e => {
  e.preventDefault();
  e.stopPropagation();
  thrustBtn.classList.add('active');
  touchThrust = true;
}, { passive: false });
thrustBtn.addEventListener('touchend', e => {
  e.preventDefault();
  thrustBtn.classList.remove('active');
  touchThrust = false;
}, { passive: false });
thrustBtn.addEventListener('touchcancel', () => {
  thrustBtn.classList.remove('active');
  touchThrust = false;
});

let ship, bullets, asteroids, particles, score, lives, level, gameOver;
let invulnTimer;

function initGame() {
  ship = new Ship();
  bullets = [];
  asteroids = [];
  particles = [];
  score = 0;
  lives = 3;
  level = 1;
  gameOver = false;
  invulnTimer = 120;
  spawnAsteroids(4);
  updateUI();
  document.getElementById('game-over').style.display = 'none';
}

function spawnAsteroids(n) {
  for (let i = 0; i < n; i++) {
    let pos, ok;
    for (let tries = 0; tries < 50; tries++) {
      pos = new Vec(Math.random() * W, Math.random() * H);
      if (pos.sub(ship.pos).len() > 150) { ok = true; break; }
    }
    if (!ok) pos = new Vec(Math.random() * W, Math.random() * H);
    asteroids.push(new Asteroid(pos, 3));
  }
}

function shoot() {
  if (gameOver) return;
  ship.shoot();
}

class Ship {
  constructor() {
    this.pos = new Vec(W/2, H/2);
    this.vel = new Vec(0, 0);
    this.angle = -Math.PI/2;
    this.radius = 16;
    this.thrusting = false;
    this.bulletCooldown = 0;
    this.keyboardRotating = false;
  }
  update() {
    this.thrusting = false;
    this.keyboardRotating = false;

    // Keyboard rotation (overrides pointer aim)
    if (KEY['ArrowLeft'] || KEY['KeyA']) { this.angle -= 0.05; this.keyboardRotating = true; }
    if (KEY['ArrowRight'] || KEY['KeyD']) { this.angle += 0.05; this.keyboardRotating = true; }

    // Aim toward pointer (mouse/touch) if active and not using keyboard rotation
    if (!this.keyboardRotating && pointerActive) {
      const dx = pointerPos.x - this.pos.x;
      const dy = pointerPos.y - this.pos.y;
      if (Math.hypot(dx, dy) > 3) {
        this.angle = Math.atan2(dy, dx);
      }
    }

    // Thrust
    const keyThrust = KEY['ArrowUp'] || KEY['KeyW'];
    if (keyThrust || touchThrust) {
      this.thrusting = true;
      this.vel = this.vel.add(Vec.fromAngle(this.angle).mul(0.15));
    }

    if (KEY['ArrowDown'] || KEY['KeyS']) this.vel = this.vel.mul(0.98);

    this.vel = this.vel.mul(0.99);
    this.pos = this.pos.add(this.vel);
    this.pos = new Vec(wrap(this.pos.x, W), wrap(this.pos.y, H));

    if (this.bulletCooldown > 0) this.bulletCooldown--;

    if ((KEY['Space'] || KEY['KeyF']) && this.bulletCooldown === 0) {
      this.shoot();
      this.bulletCooldown = 10;
    }
  }
  shoot() {
    const dir = Vec.fromAngle(this.angle);
    const p = this.pos.add(dir.mul(this.radius));
    bullets.push(new Bullet(p, dir));
  }
  draw() {
    const invulnFlash = invulnTimer > 0 && Math.floor(invulnTimer / 4) % 2;
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.rotate(this.angle);

    const bodyColor = invulnFlash ? '#555' : '#00ddff';
    const accentColor = invulnFlash ? '#333' : '#ff8800';
    ctx.shadowColor = bodyColor;
    ctx.shadowBlur = invulnFlash ? 0 : 15;

    ctx.fillStyle = bodyColor;
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.radius + 6, 0);
    ctx.lineTo(-this.radius * 0.8, -this.radius * 0.8);
    ctx.lineTo(-this.radius * 0.3, 0);
    ctx.lineTo(-this.radius * 0.8, this.radius * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.restore();

    if (this.thrusting) {
      ctx.save();
      ctx.translate(this.pos.x, this.pos.y);
      ctx.rotate(this.angle);
      const grad = ctx.createLinearGradient(-this.radius * 0.5, 0, -this.radius - 18, 0);
      grad.addColorStop(0, '#ffaa00');
      grad.addColorStop(0.5, '#ff4400');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(-this.radius * 0.3, -5);
      ctx.lineTo(-this.radius - 10 - Math.random() * 8, 0);
      ctx.lineTo(-this.radius * 0.3, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // pointer line (subtle aim indicator)
    if (pointerActive && !this.keyboardRotating) {
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 221, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(this.pos.x, this.pos.y);
      ctx.lineTo(pointerPos.x, pointerPos.y);
      ctx.stroke();
      ctx.restore();
    }
  }
  getVertices() {
    const v = [];
    const n = 3;
    for (let i = 0; i < n; i++) {
      const a = this.angle + (i / n) * Math.PI * 2;
      const r = i === 0 ? this.radius + 6 : this.radius * 0.8;
      v.push(this.pos.add(Vec.fromAngle(a).mul(r)));
    }
    return v;
  }
  hits(asteroid) {
    const verts = this.getVertices();
    for (const v of verts) {
      if (v.sub(asteroid.pos).len() < asteroid.radius) return true;
    }
    return false;
  }
}

class Bullet {
  constructor(pos, dir) {
    this.pos = pos;
    this.vel = dir.mul(8);
    this.life = 50;
  }
  update() {
    this.pos = this.pos.add(this.vel);
    this.pos = new Vec(wrap(this.pos.x, W), wrap(this.pos.y, H));
    this.life--;
  }
  draw() {
    ctx.shadowColor = '#ff6600';
    ctx.shadowBlur = 15;
    ctx.fillStyle = '#ff8800';
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

class Asteroid {
  constructor(pos, size) {
    this.pos = pos;
    this.vel = Vec.fromAngle(Math.random() * Math.PI * 2).mul(0.5 + Math.random() * 1.5);
    this.size = size;
    this.radius = size * 14;
    this.angle = Math.random() * Math.PI * 2;
    this.rotSpeed = (Math.random() - 0.5) * 0.02;
    this.lemonShape = this.generateLemon();
    this.bumps = 3 + Math.floor(Math.random() * 4);
  }
  generateLemon() {
    const verts = [];
    const n = 16;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const bulge = 0.8 + 0.2 * Math.abs(Math.cos(a * 1.5));
      const stretchX = 1.3;
      const stretchY = 0.85;
      const r = this.radius * bulge;
      verts.push(new Vec(Math.cos(a) * r * stretchX, Math.sin(a) * r * stretchY));
    }
    return verts;
  }
  update() {
    this.pos = this.pos.add(this.vel);
    this.pos = new Vec(wrap(this.pos.x, W), wrap(this.pos.y, H));
    this.angle += this.rotSpeed;
  }
  draw() {
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.rotate(this.angle);

    ctx.shadowColor = '#aaff00';
    ctx.shadowBlur = 20;

    const grad = ctx.createRadialGradient(-this.radius*0.2, -this.radius*0.2, 0, 0, 0, this.radius * 1.3);
    grad.addColorStop(0, '#fff44f');
    grad.addColorStop(0.4, '#ffdd00');
    grad.addColorStop(0.8, '#e6b800');
    grad.addColorStop(1, '#cc9900');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(this.lemonShape[0].x, this.lemonShape[0].y);
    for (let i = 1; i < this.lemonShape.length; i++) {
      ctx.lineTo(this.lemonShape[i].x, this.lemonShape[i].y);
    }
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 0;

    ctx.strokeStyle = '#aa7700';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.ellipse(-this.radius*0.25, -this.radius*0.3, this.radius*0.3, this.radius*0.15, -0.5, 0, Math.PI*2);
    ctx.fill();

    ctx.fillStyle = 'rgba(170, 120, 0, 0.2)';
    for (let i = 0; i < this.bumps; i++) {
      const ba = (i / this.bumps) * Math.PI * 2 + 0.5;
      const br = this.radius * 0.7;
      ctx.beginPath();
      ctx.arc(Math.cos(ba) * br * 1.2, Math.sin(ba) * br * 0.85, this.radius * 0.08, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#5a8a2a';
    ctx.shadowColor = '#5a8a2a';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.ellipse(this.radius * 1.15, -this.radius * 0.1, this.radius * 0.15, this.radius * 0.1, 0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#4a7a1a';
    ctx.shadowColor = '#4a7a1a';
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.ellipse(this.radius * 1.2, -this.radius * 0.25, this.radius * 0.06, this.radius * 0.12, 0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.restore();
  }
  split() {
    if (this.size <= 1) return [];
    const children = [];
    for (let i = 0; i < 2; i++) {
      const a = new Asteroid(this.pos, this.size - 1);
      a.vel = this.vel.add(Vec.fromAngle(Math.random() * Math.PI * 2).mul(2));
      children.push(a);
    }
    return children;
  }
}

function spawnExplosion(pos, count, color) {
  for (let i = 0; i < count; i++) {
    const dir = Vec.fromAngle(Math.random() * Math.PI * 2);
    const hue = color ? null : 40 + Math.random() * 30;
    particles.push({
      pos: pos,
      vel: dir.mul(1 + Math.random() * 4),
      life: 20 + Math.random() * 30,
      maxLife: 50,
      color: color || `hsl(${hue}, 100%, ${50 + Math.random() * 40}%)`,
      radius: 1.5 + Math.random() * 3
    });
  }
  for (let i = 0; i < count / 2; i++) {
    const dir = Vec.fromAngle(Math.random() * Math.PI * 2);
    particles.push({
      pos: pos,
      vel: dir.mul(2 + Math.random() * 5),
      life: 10 + Math.random() * 15,
      maxLife: 25,
      color: `hsl(55, 100%, 70%)`,
      radius: 0.5 + Math.random() * 1.5
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.pos = p.pos.add(p.vel);
    p.vel = p.vel.mul(0.97);
    p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles() {
  for (const p of particles) {
    const alpha = p.life / p.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.arc(p.pos.x, p.pos.y, p.radius * (0.5 + 0.5 * alpha), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

function updateUI() {
  document.getElementById('score').textContent = `🍋 SCORE: ${score}`;
  document.getElementById('lives').textContent = `❤️ LIVES: ${lives}`;
  document.getElementById('level').textContent = `⭐ LEVEL: ${level}`;
}

function update() {
  if (gameOver) return;

  ship.update();
  if (invulnTimer > 0) invulnTimer--;

  for (let i = bullets.length - 1; i >= 0; i--) {
    bullets[i].update();
    if (bullets[i].life <= 0) bullets.splice(i, 1);
  }

  for (let i = asteroids.length - 1; i >= 0; i--) {
    asteroids[i].update();
  }

  for (let i = bullets.length - 1; i >= 0; i--) {
    for (let j = asteroids.length - 1; j >= 0; j--) {
      if (bullets[i] && asteroids[j] && bullets[i].pos.sub(asteroids[j].pos).len() < asteroids[j].radius) {
        const a = asteroids[j];
        const pts = [100, 50, 20][a.size - 1] || 0;
        score += pts;
        spawnExplosion(a.pos, 15);
        const children = a.split();
        asteroids.splice(j, 1);
        asteroids.push(...children);
        bullets.splice(i, 1);
        updateUI();
        break;
      }
    }
  }

  if (invulnTimer === 0) {
    for (let j = asteroids.length - 1; j >= 0; j--) {
      if (ship.hits(asteroids[j])) {
        spawnExplosion(ship.pos, 30, '#ff4444');
        spawnExplosion(ship.pos, 15, '#ff8800');
        lives--;
        updateUI();
        if (lives <= 0) {
          gameOver = true;
          document.getElementById('game-over').style.display = 'block';
          return;
        }
        invulnTimer = 120;
        ship.pos = new Vec(W/2, H/2);
        ship.vel = new Vec(0, 0);
        break;
      }
    }
  }

  updateParticles();

  if (asteroids.length === 0) {
    level++;
    spawnAsteroids(Math.min(level + 2, 12));
    updateUI();
  }
}

function draw() {
  const grad = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, W*0.7);
  grad.addColorStop(0, '#0f0f2a');
  grad.addColorStop(0.5, '#0a0a1a');
  grad.addColorStop(1, '#050510');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  for (const a of asteroids) a.draw();
  for (const b of bullets) b.draw();
  if (!gameOver || lives > 0) ship.draw();
  drawParticles();

  ctx.strokeStyle = 'rgba(50, 50, 100, 0.15)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 60) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += 60) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

initGame();
loop();
