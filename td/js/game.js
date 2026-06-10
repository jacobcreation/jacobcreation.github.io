import { ParticleSystem } from './particles.js';
import { Enemy } from './enemy.js';
import { Tower } from './tower.js';

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.width = 0;
        this.height = 0;

        this.credits = 1000;
        this.lives = 20;
        this.wave = 0;

        this.enemies = [];
        this.playerTroops = [];
        this.towers = [];
        this.projectiles = [];
        this.particles = new ParticleSystem();
        this.maxAiTroops = 90;
        this.maxPlayerTroops = 60;
        this.maxProjectiles = 160;
        this.frame = 0;
        this.lastHud = {};
        this.lastBannerText = '';

        this.tileSize = 40;
        this.worldWidth = 5200;
        this.worldHeight = 3600;
        this.camera = { x: 4260, y: 700 };
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };
        this.cameraStart = { x: 0, y: 0 };
        this.hasDragged = false;

        this.path = [
            { x: 4, y: 34 },
            { x: 18, y: 34 },
            { x: 18, y: 26 },
            { x: 35, y: 26 },
            { x: 35, y: 18 },
            { x: 55, y: 18 },
            { x: 55, y: 31 },
            { x: 76, y: 31 },
            { x: 76, y: 15 },
            { x: 102, y: 15 },
            { x: 116, y: 24 }
        ];
        this.playerBasePoint = this.path[this.path.length - 1];
        this.aiBases = this.createAiBases();
        this.roads = this.createRoads();

        this.lastStatus = 'AI factions are choosing targets...';
        this.hud = {
            credits: document.getElementById('credits'),
            lives: document.getElementById('lives'),
            aiBases: document.getElementById('ai-base'),
            wave: document.getElementById('wave'),
            status: document.getElementById('status-banner')
        };

        this.selectedTowerType = null;
        this.mouseX = 0;
        this.mouseY = 0;

        this.resizeCanvas();
        this.setupEventListeners();
        this.startLoop();
        this.updateHUD();
    }

    createRoads() {
        return [
            this.path,
            ...this.aiBases.map(base => this.buildPathBetween(base.point, this.playerBasePoint)),
            ...this.createAiBattleRoads(),
            [
                { x: 3, y: 11 },
                { x: 23, y: 11 },
                { x: 23, y: 6 },
                { x: 48, y: 6 },
                { x: 48, y: 12 },
                { x: 70, y: 12 },
                { x: 70, y: 7 },
                { x: 122, y: 7 }
            ],
            [
                { x: 8, y: 68 },
                { x: 29, y: 68 },
                { x: 29, y: 56 },
                { x: 62, y: 56 },
                { x: 62, y: 65 },
                { x: 96, y: 65 },
                { x: 96, y: 49 },
                { x: 124, y: 49 }
            ],
            [
                { x: 12, y: 44 },
                { x: 12, y: 21 },
                { x: 29, y: 21 },
                { x: 29, y: 42 },
                { x: 47, y: 42 },
                { x: 47, y: 23 }
            ],
            [
                { x: 84, y: 23 },
                { x: 84, y: 40 },
                { x: 105, y: 40 },
                { x: 105, y: 28 },
                { x: 122, y: 28 }
            ]
        ];
    }

    createAiBattleRoads() {
        const roads = [];
        for (let i = 0; i < this.aiBases.length; i++) {
            for (let j = i + 1; j < this.aiBases.length; j++) {
                roads.push(this.buildPathBetween(this.aiBases[i].point, this.aiBases[j].point));
            }
        }
        return roads;
    }

    createAiBases() {
        return [
            { id: 'ember', name: 'EMBER AI', point: this.path[0], health: 30, maxHealth: 30, color: '#ff3e3e', timer: this.chooseNextWaveDelay() },
            { id: 'amber', name: 'AMBER AI', point: { x: 122, y: 7 }, health: 30, maxHealth: 30, color: '#ffae00', timer: this.chooseNextWaveDelay() },
            { id: 'violet', name: 'VIOLET AI', point: { x: 124, y: 49 }, health: 30, maxHealth: 30, color: '#bd00ff', timer: this.chooseNextWaveDelay() },
            { id: 'crimson', name: 'CRIMSON AI', point: { x: 47, y: 23 }, health: 30, maxHealth: 30, color: '#ff3864', timer: this.chooseNextWaveDelay() }
        ];
    }

    buildPathBetween(from, to) {
        const midX = Math.round((from.x + to.x) / 2);
        const midY = Math.round((from.y + to.y) / 2);
        return [
            { x: from.x, y: from.y },
            { x: midX, y: from.y },
            { x: midX, y: midY },
            { x: to.x, y: midY },
            { x: to.x, y: to.y }
        ];
    }

    setupEventListeners() {
        window.addEventListener('resize', () => this.resizeCanvas());

        document.querySelectorAll('.tower-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const type = e.currentTarget.dataset.type;
                if (this.selectedTowerType === type) {
                    this.selectedTowerType = null;
                    e.currentTarget.classList.remove('selected');
                } else {
                    this.selectedTowerType = type;
                    document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected'));
                    e.currentTarget.classList.add('selected');
                }
            });
        });

        document.getElementById('troop-btn').addEventListener('click', () => this.sendTroops());

        this.canvas.addEventListener('pointerdown', (e) => {
            this.isDragging = true;
            this.hasDragged = false;
            this.canvas.setPointerCapture(e.pointerId);
            this.canvas.classList.add('dragging');
            this.dragStart = { x: e.clientX, y: e.clientY };
            this.cameraStart = { ...this.camera };
        });

        this.canvas.addEventListener('pointermove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = e.clientX - rect.left;
            this.mouseY = e.clientY - rect.top;

            if (!this.isDragging) return;

            const dx = e.clientX - this.dragStart.x;
            const dy = e.clientY - this.dragStart.y;
            if (Math.abs(dx) + Math.abs(dy) > 5) this.hasDragged = true;
            this.camera.x = this.cameraStart.x - dx;
            this.camera.y = this.cameraStart.y - dy;
            this.clampCamera();
        });

        this.canvas.addEventListener('pointerup', (e) => {
            this.finishDrag(e.pointerId);
        });

        this.canvas.addEventListener('pointercancel', (e) => {
            this.finishDrag(e.pointerId);
        });

        this.canvas.addEventListener('click', (e) => {
            if (this.hasDragged) return;

            const rect = this.canvas.getBoundingClientRect();
            const world = this.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
            const gridX = Math.floor(world.x / this.tileSize);
            const gridY = Math.floor(world.y / this.tileSize);

            if (this.selectedTowerType) {
                this.placeTower(gridX, gridY);
            }
        });
    }

    resizeCanvas() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        this.width = Math.floor(rect.width);
        this.height = Math.floor(rect.height);
        this.canvas.width = Math.floor(this.width * dpr);
        this.canvas.height = Math.floor(this.height * dpr);
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.clampCamera();
    }

    finishDrag(pointerId) {
        if (!this.isDragging) return;
        this.isDragging = false;
        this.canvas.classList.remove('dragging');
        try {
            this.canvas.releasePointerCapture(pointerId);
        } catch {
            // The pointer may already be released by the browser.
        }
    }

    clampCamera() {
        this.camera.x = Math.max(0, Math.min(Math.max(0, this.worldWidth - this.width), this.camera.x));
        this.camera.y = Math.max(0, Math.min(Math.max(0, this.worldHeight - this.height), this.camera.y));
    }

    screenToWorld(x, y) {
        return {
            x: x + this.camera.x,
            y: y + this.camera.y
        };
    }

    worldPoint(point) {
        return {
            x: point.x * this.tileSize + this.tileSize / 2,
            y: point.y * this.tileSize + this.tileSize / 2
        };
    }

    isOnAnyRoad(gx, gy) {
        return this.roads.some(road => this.isOnRoad(gx, gy, road));
    }

    isOnRoad(gx, gy, road) {
        return road.some((p, i) => {
            if (i === 0) return false;
            const prev = road[i - 1];
            const minX = Math.min(prev.x, p.x);
            const maxX = Math.max(prev.x, p.x);
            const minY = Math.min(prev.y, p.y);
            const maxY = Math.max(prev.y, p.y);

            if (prev.y === p.y) {
                return gy === prev.y && gx >= minX && gx <= maxX;
            }

            if (prev.x === p.x) {
                return gx === prev.x && gy >= minY && gy <= maxY;
            }

            return false;
        });
    }

    placeTower(gx, gy) {
        if (gx < 0 || gy < 0 || gx * this.tileSize > this.worldWidth || gy * this.tileSize > this.worldHeight) return;
        if (this.isOnAnyRoad(gx, gy)) return;

        const hasTower = this.towers.some(t =>
            Math.floor(t.x / this.tileSize) === gx &&
            Math.floor(t.y / this.tileSize) === gy
        );
        if (hasTower) return;

        const cost = Tower.getStats(this.selectedTowerType).cost;
        if (this.credits >= cost) {
            this.credits -= cost;
            const centerX = gx * this.tileSize + this.tileSize / 2;
            const centerY = gy * this.tileSize + this.tileSize / 2;
            this.towers.push(new Tower(centerX, centerY, this.selectedTowerType));
            this.updateHUD();
            this.particles.addExplosion(centerX, centerY, '#00f2ff', 15);
        }
    }

    sendTroops() {
        const cost = 75;
        if (this.credits < cost) return;
        if (this.playerTroops.length >= this.maxPlayerTroops) {
            this.setStatusText('Your troop lanes are full. Wait for a squad to land.');
            return;
        }

        const target = this.getRandomLivingAiBase();
        if (!target) return;

        this.credits -= cost;
        const path = this.buildPathBetween(this.playerBasePoint, target.point);
        const squadSize = Math.min(4, this.maxPlayerTroops - this.playerTroops.length);
        for (let i = 0; i < squadSize; i++) {
            const troop = new Enemy(path, this.tileSize, this.wave, {
                team: 'player',
                targetBaseId: target.id,
                speed: 3.2,
                health: 70 + this.wave * 12,
                color: '#35ff8a',
                radius: 11,
                reward: 0,
                baseDamage: 1
            });
            troop.x -= i * 22;
            troop.y += (i % 2) * 16 - 8;
            this.playerTroops.push(troop);
        }
        const start = this.worldPoint(this.playerBasePoint);
        this.particles.addExplosion(start.x, start.y, '#35ff8a', 22);
        this.lastStatus = `Your squad is attacking ${target.name}.`;
        this.updateHUD();
    }

    startNextWave() {
        this.wave++;
        this.updateHUD();
    }

    updateHUD() {
        this.setHudText('credits', this.credits);
        this.setHudText('lives', this.lives);
        this.setHudText('aiBases', this.getLivingAiBases().length);
        this.setHudText('wave', this.wave);
        this.updateStatusBanner();
    }

    setHudText(key, value) {
        if (this.lastHud[key] === value) return;
        this.lastHud[key] = value;
        this.hud[key].textContent = value;
    }

    startLoop() {
        const loop = () => {
            this.update();
            this.draw();
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    update() {
        this.frame++;
        this.particles.update();
        this.updateAiBases();
        this.updateTroopCombat();
        this.updateEnemyTroops();
        this.updatePlayerTroops();

        this.towers.forEach(t => t.update(this.enemies, this.projectiles, this.particles));

        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.update(this.particles);
            if (p.isDead) {
                this.projectiles.splice(i, 1);
            }
        }

        if (this.projectiles.length > this.maxProjectiles) {
            this.projectiles.splice(0, this.projectiles.length - this.maxProjectiles);
        }
    }

    chooseNextWaveDelay() {
        const minSeconds = 2.5;
        const maxSeconds = 8.5;
        return Math.round((minSeconds + Math.random() * (maxSeconds - minSeconds)) * 60);
    }

    updateAiBases() {
        if (this.lives <= 0) return;

        for (const base of this.getLivingAiBases()) {
            base.timer--;
            if (base.timer > 0) continue;

            const target = this.chooseAiTarget(base);
            if (target) {
                this.spawnAiSquad(base, target);
            }
            base.timer = this.chooseNextWaveDelay();
        }

        this.updateStatusBanner();
    }

    chooseAiTarget(attacker) {
        const targets = [
            { id: 'player', name: 'YOUR BASE', point: this.playerBasePoint, color: '#35ff8a' },
            ...this.getLivingAiBases().filter(base => base.id !== attacker.id)
        ];
        if (targets.length === 0) return null;
        return targets[Math.floor(Math.random() * targets.length)];
    }

    spawnAiSquad(attacker, target) {
        if (this.enemies.length >= this.maxAiTroops) {
            this.lastStatus = `${attacker.name} is waiting for crowded roads to clear.`;
            return;
        }

        this.startNextWave();
        const path = this.buildPathBetween(attacker.point, target.point);
        const squadSize = Math.min(3 + Math.min(6, Math.floor(this.wave / 3)), this.maxAiTroops - this.enemies.length);

        for (let i = 0; i < squadSize; i++) {
            const troop = new Enemy(path, this.tileSize, this.wave, {
                team: attacker.id,
                targetBaseId: target.id,
                speed: 2.9 + Math.random() * 0.7,
                health: 45 + this.wave * 14,
                color: attacker.color,
                radius: 11,
                reward: 15,
                baseDamage: 1
            });
            troop.x -= i * 18;
            troop.y += (i % 3 - 1) * 14;
            this.enemies.push(troop);
        }

        const start = this.worldPoint(attacker.point);
        this.particles.addExplosion(start.x, start.y, attacker.color, 20);
        this.lastStatus = `${attacker.name} chose to attack ${target.name}!`;
    }

    getLivingAiBases() {
        return this.aiBases.filter(base => base.health > 0);
    }

    getRandomLivingAiBase() {
        const bases = this.getLivingAiBases();
        if (bases.length === 0) return null;
        return bases[Math.floor(Math.random() * bases.length)];
    }

    updateStatusBanner(message = null) {
        if (message) {
            this.setStatusText(message);
            return;
        }

        if (this.frame % 12 !== 0) return;

        if (this.enemies.length + this.playerTroops.length > 0) {
            this.setStatusText(`${this.lastStatus} ${this.enemies.length + this.playerTroops.length} troops moving.`);
            return;
        }

        const livingBases = this.getLivingAiBases();
        const nextBase = livingBases.reduce((soonest, base) => base.timer < soonest.timer ? base : soonest, livingBases[0]);
        if (!nextBase) {
            this.setStatusText('All AI bases are destroyed. The land is yours.');
            return;
        }

        this.setStatusText(`${nextBase.name} may choose a target in ${(nextBase.timer / 60).toFixed(1)}s`);
    }

    setStatusText(text) {
        if (!this.hud.status || this.lastBannerText === text) return;
        this.lastBannerText = text;
        this.hud.status.textContent = text;
    }

    updateEnemyTroops() {
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            enemy.update(this.particles);

            if (enemy.reachedEnd) {
                this.damageTargetBase(enemy.targetBaseId, enemy.baseDamage, enemy.color);
                this.enemies.splice(i, 1);
                this.updateHUD();
            } else if (enemy.isDead) {
                this.credits += enemy.reward;
                this.enemies.splice(i, 1);
                this.updateHUD();
            }
        }
    }

    updateTroopCombat() {
        const allTroops = [...this.playerTroops, ...this.enemies];
        for (let i = 0; i < allTroops.length; i++) {
            const troop = allTroops[i];
            if (troop.isDead) continue;

            for (let j = i + 1; j < allTroops.length; j++) {
                const target = allTroops[j];
                if (target.isDead || target.team === troop.team) continue;
                if (this.getDistance(troop, target) >= troop.radius + target.radius + 6) continue;

                target.takeDamage(0.34, this.particles);
                troop.takeDamage(0.34, this.particles);
                if (Math.random() > 0.86) {
                    this.particles.addTrail((troop.x + target.x) / 2, (troop.y + target.y) / 2, '#ffffff');
                }
                break;
            }
        }
    }

    updatePlayerTroops() {
        for (let i = this.playerTroops.length - 1; i >= 0; i--) {
            const troop = this.playerTroops[i];
            troop.update(this.particles);

            if (troop.reachedEnd) {
                this.damageTargetBase(troop.targetBaseId, troop.baseDamage, troop.color);
                this.playerTroops.splice(i, 1);
                this.updateHUD();
            } else if (troop.isDead) {
                this.playerTroops.splice(i, 1);
            }
        }
    }

    damageTargetBase(targetBaseId, damage, color) {
        if (targetBaseId === 'player') {
            this.lives -= damage;
            const point = this.worldPoint(this.playerBasePoint);
            this.particles.addExplosion(point.x, point.y, color, 16);
            this.lastStatus = 'Your base is under attack!';
            if (this.lives <= 0) {
                alert('Game Over!');
                location.reload();
            }
            return;
        }

        const base = this.aiBases.find(item => item.id === targetBaseId);
        if (!base || base.health <= 0) return;

        base.health -= damage;
        const point = this.worldPoint(base.point);
        this.particles.addExplosion(point.x, point.y, color, 16);
        this.lastStatus = `${base.name} is taking damage!`;
        if (base.health <= 0) {
            base.health = 0;
            this.lastStatus = `${base.name} was destroyed!`;
            this.credits += 150;
        }
    }

    getDistance(a, b) {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    isVisible(x, y, padding = 0) {
        return x >= this.camera.x - padding &&
            x <= this.camera.x + this.width + padding &&
            y >= this.camera.y - padding &&
            y <= this.camera.y + this.height + padding;
    }

    draw() {
        this.ctx.fillStyle = '#07100d';
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.ctx.save();
        this.ctx.translate(-this.camera.x, -this.camera.y);

        this.drawLand();
        this.drawRoads();
        this.drawBases();

        this.towers.forEach(t => {
            if (this.isVisible(t.x, t.y, t.range)) t.draw(this.ctx);
        });
        this.enemies.forEach(e => {
            if (this.isVisible(e.x, e.y, 40)) e.draw(this.ctx);
        });
        this.playerTroops.forEach(t => {
            if (this.isVisible(t.x, t.y, 40)) t.draw(this.ctx);
        });
        this.projectiles.forEach(p => {
            if (this.isVisible(p.x, p.y, 30)) p.draw(this.ctx);
        });
        this.drawTowerPreview();
        this.particles.draw(this.ctx);

        this.ctx.restore();
        this.drawMinimap();
    }

    drawLand() {
        const gridSize = this.tileSize * 2;
        const startX = Math.floor(this.camera.x / gridSize) * gridSize;
        const endX = this.camera.x + this.width + gridSize;
        const startY = Math.floor(this.camera.y / gridSize) * gridSize;
        const endY = this.camera.y + this.height + gridSize;

        this.ctx.fillStyle = '#07100d';
        this.ctx.fillRect(this.camera.x, this.camera.y, this.width, this.height);

        this.ctx.strokeStyle = 'rgba(0, 242, 255, 0.06)';
        this.ctx.lineWidth = 1;
        for (let x = startX; x <= endX; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, this.camera.y);
            this.ctx.lineTo(x, this.camera.y + this.height);
            this.ctx.stroke();
        }
        for (let y = startY; y <= endY; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(this.camera.x, y);
            this.ctx.lineTo(this.camera.x + this.width, y);
            this.ctx.stroke();
        }
    }

    drawRoads() {
        this.roads.forEach((road, index) => {
            const isMainRoad = index === 0;
            this.ctx.strokeStyle = isMainRoad ? 'rgba(0, 242, 255, 0.34)' : 'rgba(255, 174, 0, 0.16)';
            this.ctx.lineWidth = isMainRoad ? 34 : 22;
            this.ctx.lineJoin = 'round';
            this.ctx.lineCap = 'round';
            this.ctx.shadowBlur = isMainRoad ? 6 : 0;
            this.ctx.shadowColor = isMainRoad ? '#00f2ff' : '#ffae00';
            this.ctx.beginPath();
            road.forEach((p, i) => {
                const point = this.worldPoint(p);
                if (i === 0) this.ctx.moveTo(point.x, point.y);
                else this.ctx.lineTo(point.x, point.y);
            });
            this.ctx.stroke();

            this.ctx.shadowBlur = 0;
            this.ctx.strokeStyle = isMainRoad ? 'rgba(210, 251, 255, 0.18)' : 'rgba(255, 226, 158, 0.10)';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        });
    }

    drawBases() {
        const playerBase = this.worldPoint(this.path[this.path.length - 1]);
        this.drawBase(playerBase.x, playerBase.y, '#35ff8a', 'YOUR BASE', this.lives, 20);

        this.aiBases.forEach(base => {
            const point = this.worldPoint(base.point);
            this.drawBase(point.x, point.y, base.color, base.name, base.health, base.maxHealth);
        });
    }

    drawBase(x, y, color, label, health, maxHealth) {
        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.globalAlpha = health <= 0 ? 0.35 : 1;
        this.ctx.fillStyle = color;
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = color;
        this.ctx.beginPath();
        this.ctx.moveTo(0, -34);
        this.ctx.lineTo(32, 24);
        this.ctx.lineTo(-32, 24);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.shadowBlur = 0;
        this.ctx.fillStyle = '#06100d';
        this.ctx.fillRect(-19, 4, 38, 24);
        this.ctx.fillStyle = color;
        this.ctx.font = 'bold 14px Trebuchet MS';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(label, 0, 50);
        this.ctx.font = '12px Trebuchet MS';
        this.ctx.fillText(`${Math.max(0, health)}/${maxHealth}`, 0, 66);
        this.ctx.restore();
    }

    drawTowerPreview() {
        if (!this.selectedTowerType) return;

        const world = this.screenToWorld(this.mouseX, this.mouseY);
        const gx = Math.floor(world.x / this.tileSize);
        const gy = Math.floor(world.y / this.tileSize);
        const cx = gx * this.tileSize + this.tileSize / 2;
        const cy = gy * this.tileSize + this.tileSize / 2;
        const stats = Tower.getStats(this.selectedTowerType);
        const range = stats.range;
        const color = this.hexToRgba(stats.color, 0.2);

        this.ctx.beginPath();
        this.ctx.arc(cx, cy, range, 0, Math.PI * 2);
        this.ctx.fillStyle = color;
        this.ctx.fill();
        this.ctx.strokeStyle = color;
        this.ctx.stroke();

        this.ctx.fillStyle = stats.color;
        this.ctx.globalAlpha = this.isOnAnyRoad(gx, gy) ? 0.2 : 0.5;
        this.ctx.beginPath();
        this.ctx.moveTo(cx, cy - 18);
        this.ctx.lineTo(cx + 18, cy);
        this.ctx.lineTo(cx, cy + 18);
        this.ctx.lineTo(cx - 18, cy);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.globalAlpha = 1.0;
    }

    hexToRgba(hex, alpha) {
        const value = hex.replace('#', '');
        const r = parseInt(value.slice(0, 2), 16);
        const g = parseInt(value.slice(2, 4), 16);
        const b = parseInt(value.slice(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    drawMinimap() {
        const mapW = 150;
        const mapH = 104;
        const x = this.width - mapW - 14;
        const y = this.height - mapH - 14;
        const scaleX = mapW / this.worldWidth;
        const scaleY = mapH / this.worldHeight;

        this.ctx.save();
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.58)';
        this.ctx.strokeStyle = 'rgba(0, 242, 255, 0.45)';
        this.ctx.lineWidth = 1;
        this.ctx.fillRect(x, y, mapW, mapH);
        this.ctx.strokeRect(x, y, mapW, mapH);

        this.ctx.strokeStyle = 'rgba(0, 242, 255, 0.7)';
        this.ctx.lineWidth = 2;
        this.roads.forEach((road, roadIndex) => {
            this.ctx.strokeStyle = roadIndex === 0 ? 'rgba(0, 242, 255, 0.7)' : 'rgba(255, 174, 0, 0.35)';
            this.ctx.beginPath();
            road.forEach((p, i) => {
                const point = this.worldPoint(p);
                const px = x + point.x * scaleX;
                const py = y + point.y * scaleY;
                if (i === 0) this.ctx.moveTo(px, py);
                else this.ctx.lineTo(px, py);
            });
            this.ctx.stroke();
        });

        this.drawMinimapBase(x, y, scaleX, scaleY, this.playerBasePoint, '#35ff8a');
        this.aiBases.forEach(base => {
            this.drawMinimapBase(x, y, scaleX, scaleY, base.point, base.health > 0 ? base.color : '#333333');
        });

        this.ctx.strokeStyle = '#fff';
        this.ctx.strokeRect(x + this.camera.x * scaleX, y + this.camera.y * scaleY, this.width * scaleX, this.height * scaleY);
        this.ctx.restore();
    }

    drawMinimapBase(mapX, mapY, scaleX, scaleY, point, color) {
        const world = this.worldPoint(point);
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(mapX + world.x * scaleX, mapY + world.y * scaleY, 4, 0, Math.PI * 2);
        this.ctx.fill();
    }
}

window.addEventListener('load', () => {
    new Game();
});
