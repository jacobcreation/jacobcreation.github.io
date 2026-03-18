const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const minimapCanvas = document.getElementById('minimap');
const minimapCtx = minimapCanvas.getContext('2d');

// UI Elements
const startScreen = document.getElementById('start-screen');
const deathScreen = document.getElementById('death-screen');
const startBtn = document.getElementById('start-btn');
const respawnBtn = document.getElementById('respawn-btn');
const playerNameInput = document.getElementById('player-name-input');
const fpsDisplay = document.getElementById('fps');

// Game State
let gameState = 'START'; // START, PLAYING, DEAD
let lastTime = 0;
let frameCount = 0;
let lastFpsTime = 0;
let score = 0;
let animationFrameId;

// World settings
const WORLD_SIZE = 3000;
const GRID_SIZE = 40;

// Entities
let player;
let bullets = [];
let shapes = [];
let bots = [];
let particles = [];

// Upgrades config
const UPGRADE_TYPES = [
    { id: 'regen', name: 'Health Regen', color: 'var(--stat-regen)', max: 7 },
    { id: 'maxHealth', name: 'Max Health', color: 'var(--stat-maxhealth)', max: 7 },
    { id: 'bodyDamage', name: 'Body Damage', color: 'var(--stat-bodydamage)', max: 7 },
    { id: 'bulletSpeed', name: 'Bullet Speed', color: 'var(--stat-bulletspeed)', max: 7 },
    { id: 'bulletPen', name: 'Bullet Penetration', color: 'var(--stat-bulletpen)', max: 7 },
    { id: 'bulletDam', name: 'Bullet Damage', color: 'var(--stat-bulletdam)', max: 7 },
    { id: 'reload', name: 'Reload', color: 'var(--stat-reload)', max: 7 },
    { id: 'moveSpeed', name: 'Movement Speed', color: 'var(--stat-movespeed)', max: 7 }
];

// Camera
let camera = {
    x: WORLD_SIZE / 2,
    y: WORLD_SIZE / 2,
    zoom: 1
};

// Input State
const keys = {
    w: false, a: false, s: false, d: false,
    ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false
};
const mouse = { x: 0, y: 0, worldX: 0, worldY: 0, isDown: false };

// Event Listeners
window.addEventListener('resize', resizeCanvas);
window.addEventListener('keydown', (e) => { if(keys.hasOwnProperty(e.key)) keys[e.key] = true; });
window.addEventListener('keyup', (e) => { if(keys.hasOwnProperty(e.key)) keys[e.key] = false; });
canvas.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});
canvas.addEventListener('mousedown', () => mouse.isDown = true);
canvas.addEventListener('mouseup', () => mouse.isDown = false);

startBtn.addEventListener('click', startGame);
respawnBtn.addEventListener('click', startGame);

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 20;
        this.color = '#00b0ff';
        this.angle = 0;
        this.speed = 300; // pixels per second
        this.barrelLength = 35;
        this.barrelWidth = 20;
        
        // Stats
        this.bulletSpeed = 500;
        this.bulletDamage = 10;
        this.bulletPenetration = 1;
        this.bulletSize = 10;
        this.reloadTime = 300; // ms
        this.lastShotTime = 0;
        this.maxHealth = 100;
        this.health = 100;
        this.healthRegen = 1; // hp per second
        this.bodyDamage = 10;
        
        // Progression
        this.level = 1;
        this.exp = 0;
        this.maxExp = 10;
        this.upgradePoints = 0;
        
        this.stats = {
            regen: 0,
            maxHealth: 0,
            bodyDamage: 0,
            bulletSpeed: 0,
            bulletPen: 0,
            bulletDam: 0,
            reload: 0,
            moveSpeed: 0
        };
    }

    upgradeStat(statId) {
        if (this.upgradePoints > 0 && this.stats[statId] < 7) {
            this.stats[statId]++;
            this.upgradePoints--;
            
            // Apply stat changes
            switch(statId) {
                case 'regen': this.healthRegen += 0.5; break;
                case 'maxHealth': 
                    this.maxHealth += 15; 
                    this.health += 15; // heal immediately for the new max
                    break;
                case 'bodyDamage': this.bodyDamage += 5; break;
                case 'bulletSpeed': this.bulletSpeed += 50; break;
                case 'bulletPen': this.bulletPenetration += 0.5; break;
                case 'bulletDam': this.bulletDamage += 5; break;
                case 'reload': this.reloadTime = Math.max(50, this.reloadTime - 25); break;
                case 'moveSpeed': this.speed += 20; break;
            }
            
            updateUpgradeUI();
            updateUI();
        }
    }

    gainExp(amount) {
        this.exp += amount;
        if(this === player) score += amount;
        
        while (this.exp >= this.maxExp && this.level < 45) {
            this.exp -= this.maxExp;
            this.level++;
            this.upgradePoints++;
            this.maxExp = Math.floor(this.maxExp * 1.2) + 10; // increase exp requirement
            
            // Level up bonuses
            this.maxHealth += 5;
            this.health = this.maxHealth;
            this.radius += 0.5;
            this.barrelLength += 0.5;
            this.barrelWidth += 0.2;
            
            if (this === player) updateUI(); // Immediate UI update on level up
        }
    }

    update(dt) {
        // Movement
        let dx = 0;
        let dy = 0;
        if (keys.w || keys.ArrowUp) dy -= 1;
        if (keys.s || keys.ArrowDown) dy += 1;
        if (keys.a || keys.ArrowLeft) dx -= 1;
        if (keys.d || keys.ArrowRight) dx += 1;

        if (dx !== 0 && dy !== 0) {
            const length = Math.sqrt(dx * dx + dy * dy);
            dx /= length;
            dy /= length;
        }

        this.x += dx * this.speed * (dt / 1000);
        this.y += dy * this.speed * (dt / 1000);

        // World boundaries
        this.x = Math.max(this.radius, Math.min(WORLD_SIZE - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(WORLD_SIZE - this.radius, this.y));

        // Aiming
        this.angle = Math.atan2(mouse.worldY - this.y, mouse.worldX - this.x);

        // Shooting
        if (mouse.isDown && lastTime - this.lastShotTime >= this.reloadTime) {
            this.shoot();
        }

        // Regen
        if (this.health < this.maxHealth) {
            this.health = Math.min(this.maxHealth, this.health + this.healthRegen * (dt / 1000));
        }
    }

    shoot() {
        this.lastShotTime = lastTime;
        
        // Spawn bullet based on angle
        const spawnX = this.x + Math.cos(this.angle) * this.barrelLength;
        const spawnY = this.y + Math.sin(this.angle) * this.barrelLength;
        
        bullets.push(new Bullet(
            spawnX, spawnY,
            this.angle,
            this.bulletSpeed,
            this.bulletDamage,
            this.bulletPenetration,
            this.bulletSize,
            this.color,
            this === player, // isPlayer
            this // owner
        ));
        
        // Recoil (kickback)
        const recoil = 2;
        this.x -= Math.cos(this.angle) * recoil;
        this.y -= Math.sin(this.angle) * recoil;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Draw Barrel
        ctx.fillStyle = '#999999';
        ctx.strokeStyle = '#555555';
        ctx.lineWidth = 3;
        ctx.fillRect(0, -this.barrelWidth / 2, this.barrelLength, this.barrelWidth);
        ctx.strokeRect(0, -this.barrelWidth / 2, this.barrelLength, this.barrelWidth);

        // Draw Body
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Draw Health Bar
        if (this.health < this.maxHealth) {
            ctx.rotate(-this.angle); // Un-rotate to draw health bar horizontally
            ctx.fillStyle = '#555';
            ctx.fillRect(-25, this.radius + 10, 50, 6);
            ctx.fillStyle = '#8bc34a';
            ctx.fillRect(-25, this.radius + 10, 50 * (this.health / this.maxHealth), 6);
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 1;
            ctx.strokeRect(-25, this.radius + 10, 50, 6);
        }

        // Draw Name/Level for Player/Bots
        ctx.rotate(this.angle); // Re-rotate to reset before next text drawing (or just use restore earlier)
        ctx.restore();
        
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Outfit';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 3;
        ctx.fillText(`${this.name || 'Bot'} - Lvl ${this.level}`, 0, -this.radius - 10);
        ctx.restore();
    }
}

class Bot extends Player {
    constructor(x, y) {
        super(x, y);
        this.color = '#ff5252'; // Red bots
        this.name = 'Bot ' + Math.floor(Math.random() * 1000);
        this.target = null;
        this.state = 'WANDER'; // WANDER, ATTACK
        this.stateTimer = 0;
        this.moveAngle = Math.random() * Math.PI * 2;
    }

    update(dt) {
        super.update(dt);
        
        // Find closest target (player or shapes)
        this.target = player; // simple: always target player if close
        const distToPlayer = Math.sqrt((player.x - this.x) ** 2 + (player.y - this.y) ** 2);
        
        if (distToPlayer < 800) {
            this.state = 'ATTACK';
            this.angle = Math.atan2(player.y - this.y, player.x - this.x);
        } else {
            this.state = 'WANDER';
            this.stateTimer -= dt;
            if (this.stateTimer <= 0) {
                this.moveAngle = Math.random() * Math.PI * 2;
                this.stateTimer = 2000 + Math.random() * 3000;
                this.angle = this.moveAngle;
            }
        }

        // Move
        const currentSpeed = (this.state === 'ATTACK' && distToPlayer < 300) ? -this.speed * 0.5 : this.speed;
        this.x += Math.cos(this.state === 'ATTACK' ? this.angle : this.moveAngle) * currentSpeed * (dt / 1000);
        this.y += Math.sin(this.state === 'ATTACK' ? this.angle : this.moveAngle) * currentSpeed * (dt / 1000);
        
        this.x = Math.max(this.radius, Math.min(WORLD_SIZE - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(WORLD_SIZE - this.radius, this.y));

        // Auto spend points randomly
        if (this.upgradePoints > 0) {
            const stats = ['regen', 'maxHealth', 'bodyDamage', 'bulletSpeed', 'bulletPen', 'bulletDam', 'reload', 'moveSpeed'];
            this.upgradeStat(stats[Math.floor(Math.random() * stats.length)]);
        }

        // Shoot randomly or when attacking
        if (this.state === 'ATTACK' && lastTime - this.lastShotTime >= this.reloadTime) {
            // override mouse down check for bots
            const originalMouseDist = { isDown: true }; // conceptually
            this.shoot();
        } else if (this.state === 'WANDER' && Math.random() < 0.05 && lastTime - this.lastShotTime >= this.reloadTime) {
           this.shoot();
        }
    }
}

class Bullet {
    constructor(x, y, angle, speed, damage, penetration, radius, color, isPlayer = false, owner = null) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.speed = speed;
        this.damage = damage;
        this.health = penetration; // penetration = how many things it can hit / total hp of bullet
        this.radius = radius;
        this.color = color;
        this.isPlayer = isPlayer;
        this.owner = owner;
        this.lifeTime = 3000; // lives for 3 seconds
        this.spawnTime = lastTime;
        this.markedForDeletion = false;
    }

    update(dt) {
        this.x += Math.cos(this.angle) * this.speed * (dt / 1000);
        this.y += Math.sin(this.angle) * this.speed * (dt / 1000);

        if (lastTime - this.spawnTime > this.lifeTime) {
            this.markedForDeletion = true;
        }

        // Out of bounds
        if (this.x < 0 || this.x > WORLD_SIZE || this.y < 0 || this.y > WORLD_SIZE) {
            this.markedForDeletion = true;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }
}

class Shape {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type; // 'square', 'triangle', 'pentagon'
        this.angle = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 2;
        this.markedForDeletion = false;
        
        switch(type) {
            case 'square':
                this.radius = 15;
                this.health = 10;
                this.maxHealth = 10;
                this.color = '#ffe52c';
                this.points = 10;
                this.sides = 4;
                this.damage = 8;
                break;
            case 'triangle':
                this.radius = 18;
                this.health = 30;
                this.maxHealth = 30;
                this.color = '#ff5722';
                this.points = 25;
                this.sides = 3;
                this.damage = 15;
                break;
            case 'pentagon':
                this.radius = 25;
                this.health = 100;
                this.maxHealth = 100;
                this.color = '#7e57c2';
                this.points = 130;
                this.sides = 5;
                this.damage = 30;
                break;
        }
    }

    update(dt) {
        this.angle += this.rotationSpeed * (dt / 1000);
        
        // Slow drift
        this.x += Math.cos(this.angle) * 10 * (dt / 1000);
        this.y += Math.sin(this.angle) * 10 * (dt / 1000);
        
        this.x = Math.max(this.radius, Math.min(WORLD_SIZE - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(WORLD_SIZE - this.radius, this.y));
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        
        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 3;
        
        ctx.beginPath();
        for (let i = 0; i < this.sides; i++) {
            const angle = (i * 2 * Math.PI) / this.sides - Math.PI / 2;
            const x = Math.cos(angle) * this.radius;
            const y = Math.sin(angle) * this.radius;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw Health Bar if damaged
        if (this.health < this.maxHealth) {
            ctx.rotate(-this.angle); // Un-rotate
            ctx.fillStyle = '#555';
            ctx.fillRect(-this.radius, this.radius + 5, this.radius * 2, 4);
            ctx.fillStyle = '#8bc34a';
            ctx.fillRect(-this.radius, this.radius + 5, (this.radius * 2) * (this.health / this.maxHealth), 4);
        }

        ctx.restore();
    }
}

function spawnShapes() {
    const targetShapes = 100;
    if (shapes.length < targetShapes) {
        if (Math.random() < 0.1) {
            let type = 'square';
            const r = Math.random();
            if (r > 0.95) type = 'pentagon';
            else if (r > 0.8) type = 'triangle';

            shapes.push(new Shape(
                Math.random() * WORLD_SIZE,
                Math.random() * WORLD_SIZE,
                type
            ));
        }
    }
}

function spawnBots() {
    const targetBots = 5;
    if (bots.length < targetBots && Math.random() < 0.01) {
        let spawnX = Math.random() * WORLD_SIZE;
        let spawnY = Math.random() * WORLD_SIZE;
        // Don't spawn too close to player
        while (Math.sqrt((spawnX - player.x) ** 2 + (spawnY - player.y) ** 2) < 500) {
            spawnX = Math.random() * WORLD_SIZE;
            spawnY = Math.random() * WORLD_SIZE;
        }
        
        let b = new Bot(spawnX, spawnY);
        // Level up bot randomly between 1 and player level + 5
        let targetLevel = Math.max(1, player.level + Math.floor(Math.random() * 10 - 5));
        for(let l=1; l < targetLevel; l++) {
             b.gainExp(b.maxExp);
        }
        
        bots.push(b);
    }
}

function createParticles(x, y, color, count = 5) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, color));
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.radius = 2 + Math.random() * 3;
        this.angle = Math.random() * Math.PI * 2;
        this.speed = 50 + Math.random() * 100;
        this.life = 1.0; // 100% life
        this.decay = 0.02 + Math.random() * 0.05;
        this.markedForDeletion = false;
    }

    update(dt) {
        this.x += Math.cos(this.angle) * this.speed * (dt / 1000);
        this.y += Math.sin(this.angle) * this.speed * (dt / 1000);
        this.speed *= 0.95; // Drag
        this.life -= this.decay;
        if (this.life <= 0) this.markedForDeletion = true;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

function checkCollisions() {
    // Bullets vs Shapes/Bots/Player
    for (let i = 0; i < bullets.length; i++) {
        let b = bullets[i];
        if (b.markedForDeletion) continue;

        // vs Shapes
        for (let j = 0; j < shapes.length; j++) {
            let s = shapes[j];
            if (s.markedForDeletion) continue;

            const dx = b.x - s.x;
            const dy = b.y - s.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < b.radius + s.radius) {
                // Collision!
                s.health -= b.damage;
                b.health -= 1; // Penetration goes down

                if (b.health <= 0) b.markedForDeletion = true;
                if (s.health <= 0) {
                    s.markedForDeletion = true;
                    createParticles(s.x, s.y, s.color, 8);
                    if (b.owner) {
                        b.owner.gainExp(s.points);
                    }
                }
                
                // Knockback shape slightly
                const angle = Math.atan2(dy, dx);
                s.x -= Math.cos(angle) * 5;
                s.y -= Math.sin(angle) * 5;
            }
        }
        
        // vs Player
        if (!b.isPlayer && !b.markedForDeletion) {
             const dx = b.x - player.x;
             const dy = b.y - player.y;
             if (Math.sqrt(dx*dx + dy*dy) < b.radius + player.radius) {
                 player.health -= b.damage;
                 b.health -= 1;
                 if (b.health <= 0) b.markedForDeletion = true;
                 if (player.health <= 0 && b.owner) {
                     b.owner.gainExp(1000); // kill reward
                     createParticles(player.x, player.y, player.color, 20);
                 }
             }
        }
        
        // vs Bots
        if (!b.markedForDeletion) {
             for (let k=0; k<bots.length; k++) {
                 let bot = bots[k];
                 if (b.owner === bot) continue; // Don't shoot self
                 
                 const dx = b.x - bot.x;
                 const dy = b.y - bot.y;
                 if (Math.sqrt(dx*dx + dy*dy) < b.radius + bot.radius) {
                     bot.health -= b.damage;
                     b.health -= 1;
                     if (b.health <= 0) b.markedForDeletion = true;
                     if (bot.health <= 0) {
                         bot.markedForDeletion = true;
                         createParticles(bot.x, bot.y, bot.color, 15);
                         if (b.owner) b.owner.gainExp(1000);
                     }
                 }
             }
        }
    }

    const entities = [player, ...bots, ...shapes];
    
    // Entity vs Entity Body damage
    for (let i = 0; i < entities.length; i++) {
        for (let j = i + 1; j < entities.length; j++) {
             let e1 = entities[i];
             let e2 = entities[j];
             if (e1.health <= 0 || e2.health <= 0 || e1.markedForDeletion || e2.markedForDeletion) continue;
             
             const dx = e1.x - e2.x;
             const dy = e1.y - e2.y;
             const dist = Math.sqrt(dx*dx + dy*dy);
             
             if (dist < e1.radius + e2.radius) {
                 // Body collision happens
                 let dmgTo1 = e2.bodyDamage || e2.damage || 0;
                 let dmgTo2 = e1.bodyDamage || e1.damage || 0;
                 
                 e1.health -= dmgTo1;
                 e2.health -= dmgTo2;
                 
                 if(e1.health <= 0) e1.markedForDeletion = true;
                 if(e2.health <= 0) e2.markedForDeletion = true;
                 
                 // Knockback
                 const angle = Math.atan2(dy, dx);
                 e1.x += Math.cos(angle) * 10;
                 e1.y += Math.sin(angle) * 10;
                 e2.x -= Math.cos(angle) * 10;
                 e2.y -= Math.sin(angle) * 10;
                 
                 // Ensure bounds immediately
                 if(e1.x !== undefined) e1.x = Math.max(e1.radius, Math.min(WORLD_SIZE - e1.radius, e1.x));
                 if(e1.y !== undefined) e1.y = Math.max(e1.radius, Math.min(WORLD_SIZE - e1.radius, e1.y));
                 if(e2.x !== undefined) e2.x = Math.max(e2.radius, Math.min(WORLD_SIZE - e2.radius, e2.x));
                 if(e2.y !== undefined) e2.y = Math.max(e2.radius, Math.min(WORLD_SIZE - e2.radius, e2.y));
             }
        }
    }
}

function startGame() {
    gameState = 'PLAYING';
    startScreen.classList.add('hidden');
    deathScreen.classList.add('hidden');
    
    // Reset Entity state
    bullets = [];
    shapes = [];
    score = 0;
    
    player = new Player(WORLD_SIZE / 2, WORLD_SIZE / 2);
    player.name = playerNameInput.value || 'Player';
    
    initUpgradesUI();
    updateUpgradeUI();
}

function initUpgradesUI() {
    const container = document.getElementById('upgrade-list');
    container.innerHTML = '';
    
    UPGRADE_TYPES.forEach(upg => {
        const item = document.createElement('div');
        item.className = 'upgrade-item';
        item.innerHTML = `
            <div class="upgrade-btn" style="background-color: ${upg.color}; cursor: pointer;" onclick="if(player) player.upgradeStat('${upg.id}')">+</div>
            <div class="upgrade-name">${upg.name}</div>
            <div class="upgrade-bars" id="bars-${upg.id}">
                ${Array(7).fill('<div class="upgrade-bar-tick"></div>').join('')}
            </div>
        `;
        container.appendChild(item);
    });
}

function updateUpgradeUI() {
    if (!player) return;
    
    UPGRADE_TYPES.forEach(upg => {
        const barsContainer = document.getElementById(`bars-${upg.id}`);
        if (barsContainer) {
            const ticks = barsContainer.querySelectorAll('.upgrade-bar-tick');
            const statLevel = player.stats[upg.id];
            
            ticks.forEach((tick, i) => {
                if (i < statLevel) {
                    tick.classList.add('filled');
                    tick.style.backgroundColor = upg.color;
                } else {
                    tick.classList.remove('filled');
                    tick.style.backgroundColor = 'rgba(255,255,255,0.2)';
                }
            });
        }
    });
}

function updateUI() {
    if (!player) return;
    document.getElementById('score').innerText = score;
    document.getElementById('level').innerText = player.level;
    document.getElementById('exp-bar').style.width = `${(player.exp / player.maxExp) * 100}%`;
    
    const upPointsDisplay = document.getElementById('upgrade-points-display');
    if (player.upgradePoints > 0) {
        upPointsDisplay.style.display = 'block';
        document.getElementById('upgrade-points').innerText = player.upgradePoints;
    } else {
        upPointsDisplay.style.display = 'none';
    }
}

function updateCamera() {
    // Smooth camera follow
    camera.x += (player.x - camera.x) * 0.1;
    camera.y += (player.y - camera.y) * 0.1;
    
    // Convert mouse to world coords
    mouse.worldX = (mouse.x - canvas.width / 2) / camera.zoom + camera.x;
    mouse.worldY = (mouse.y - canvas.height / 2) / camera.zoom + camera.y;
}

function drawGrid() {
    ctx.save();
    ctx.strokeStyle = '#cddbec';
    ctx.lineWidth = 1;

    const startX = Math.floor((camera.x - canvas.width / (2 * camera.zoom)) / GRID_SIZE) * GRID_SIZE;
    const startY = Math.floor((camera.y - canvas.height / (2 * camera.zoom)) / GRID_SIZE) * GRID_SIZE;
    const endX = startX + canvas.width / camera.zoom + GRID_SIZE;
    const endY = startY + canvas.height / camera.zoom + GRID_SIZE;

    ctx.beginPath();
    for (let x = startX; x <= endX; x += GRID_SIZE) {
        if (x < 0 || x > WORLD_SIZE) continue;
        ctx.moveTo(x, Math.max(0, startY));
        ctx.lineTo(x, Math.min(WORLD_SIZE, endY));
    }
    for (let y = startY; y <= endY; y += GRID_SIZE) {
        if (y < 0 || y > WORLD_SIZE) continue;
        ctx.moveTo(Math.max(0, startX), y);
        ctx.lineTo(Math.min(WORLD_SIZE, endX), y);
    }
    ctx.stroke();
    
    // Draw world boundaries
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 5;
    ctx.strokeRect(0, 0, WORLD_SIZE, WORLD_SIZE);
    
    ctx.restore();
}

function update(dt) {
    if (gameState !== 'PLAYING') return;

    player.update(dt);
    
    bullets.forEach(b => b.update(dt));
    bullets = bullets.filter(b => !b.markedForDeletion);
    
    shapes.forEach(s => s.update(dt));
    shapes = shapes.filter(s => !s.markedForDeletion);
    
    bots.forEach(bot => bot.update(dt));
    bots = bots.filter(bot => !bot.markedForDeletion);
    
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.markedForDeletion);
    
    spawnShapes();
    spawnBots();
    checkCollisions();
    
    if (player.health <= 0) {
        gameState = 'DEAD';
        deathScreen.classList.remove('hidden');
        document.getElementById('final-score').innerText = score;
        document.getElementById('final-level').innerText = player.level;
    }

    updateCamera();
}

function draw() {
    if (gameState !== 'PLAYING') return;

    ctx.fillStyle = '#f2fbff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    // Center camera
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    drawGrid();

    shapes.forEach(s => s.draw(ctx));
    bullets.forEach(b => b.draw(ctx));
    particles.forEach(p => p.draw(ctx));
    bots.forEach(bot => bot.draw(ctx));
    player.draw(ctx);

    ctx.restore();
    
    // Draw Minimap here
    drawMinimap();
}

function drawMinimap() {
    minimapCtx.fillStyle = '#222';
    minimapCtx.fillRect(0, 0, minimapCanvas.width, minimapCanvas.height);
    
    const scale = minimapCanvas.width / WORLD_SIZE;
    
    // Draw shapes on minimap
    shapes.forEach(s => {
        if (s.type === 'pentagon') {
            minimapCtx.fillStyle = s.color;
            minimapCtx.beginPath();
            minimapCtx.arc(s.x * scale, s.y * scale, 2, 0, Math.PI * 2);
            minimapCtx.fill();
        }
    });
    
    bots.forEach(bot => {
        minimapCtx.fillStyle = bot.color;
        minimapCtx.beginPath();
        minimapCtx.arc(bot.x * scale, bot.y * scale, 3, 0, Math.PI * 2);
        minimapCtx.fill();
    });
    
    // Draw player
    minimapCtx.fillStyle = player.color;
    minimapCtx.beginPath();
    minimapCtx.arc(player.x * scale, player.y * scale, 3, 0, Math.PI * 2);
    minimapCtx.fill();
}

function gameLoop(timestamp) {
    let dt = timestamp - lastTime;
    lastTime = timestamp;

    // FPS counter
    frameCount++;
    if (timestamp - lastFpsTime >= 1000) {
        fpsDisplay.innerText = frameCount;
        frameCount = 0;
        lastFpsTime = timestamp;
    }

    // Limit dt to avoid huge jumps if tab was inactive
    if (dt > 100) dt = 100;

    update(dt);
    draw();
    
    if (gameState === 'PLAYING') {
        updateUI();
    }

    animationFrameId = requestAnimationFrame(gameLoop);
}

// Init
resizeCanvas();
animationFrameId = requestAnimationFrame(gameLoop);
