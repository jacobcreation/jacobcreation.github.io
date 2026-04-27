import { GRID_SIZE, UNIT_TYPES } from './constants.js';

export class UI {
    constructor(game) {
        this.game = game;
        this.gridContainer = document.getElementById('grid-container');
        this.shopItems = document.getElementById('shop-items');
        this.goldValue = document.getElementById('gold-value');
        this.roundValue = document.getElementById('round-value');
        this.overlay = document.getElementById('overlay');
        this.resultText = document.getElementById('result-text');

        this.canvas = document.createElement('canvas');
        this.canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10;';
        this.ctx = this.canvas.getContext('2d');
        this.unitLayer = document.createElement('div');
        this.unitLayer.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:50;';
        this.particles = [];

        // Cached unit DOM elements — never recreated unless unit is new/dead
        this.unitEls = new Map(); // unit._uiId -> { el, hpFill, lastCell }
        this.unitIdCounter = 0;
        this.lastShopState = { units: [], gold: -1, index: -1, phase: '' };

        this._cw = 0;
        this._ch = 0;

        this.initGrid();
        this.startRenderLoop();
    }

    initGrid() {
        this.gridContainer.innerHTML = '';
        for (let y = 0; y < GRID_SIZE; y++) {
            for (let x = 0; x < GRID_SIZE; x++) {
                const cell = document.createElement('div');
                cell.className = 'grid-cell';
                cell.classList.add(y >= GRID_SIZE / 2 ? 'player-zone' : 'enemy-zone');
                cell.dataset.x = x;
                cell.dataset.y = y;
                cell.addEventListener('click', () => this.game.handleCellClick(x, y));
                this.gridContainer.appendChild(cell);
            }
        }
        this.gridContainer.appendChild(this.unitLayer);
        this.gridContainer.appendChild(this.canvas);
        this._syncCanvasSize();
        new ResizeObserver(() => this._syncCanvasSize()).observe(this.gridContainer);
    }

    _syncCanvasSize() {
        const w = this.gridContainer.clientWidth;
        const h = this.gridContainer.clientHeight;

        if (this.canvas.width !== w || this.canvas.height !== h) {
            this.canvas.width  = w;
            this.canvas.height = h;
            this._cw = w / GRID_SIZE;
            this._ch = h / GRID_SIZE;
        }
    }

    // ── Canvas render loop ───────────────────────────────────
    startRenderLoop() {
        let lastTime = performance.now();
        let frames = 0;
        let fps = 0;
        let needsClear = false;

        const loop = (now) => {
            requestAnimationFrame(loop);
            
            frames++;
            if (now > lastTime + 1000) {
                fps = Math.round((frames * 1000) / (now - lastTime));
                if (fps < 50) console.warn(`Low FPS: ${fps}`);
                lastTime = now;
                frames = 0;
            }

            if (this.particles.length > 0) {
                this._drawParticles();
                needsClear = true;
            } else if (needsClear && this.ctx) {
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                needsClear = false;
            }
        };
        requestAnimationFrame(loop);
    }

    _drawParticles() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const now = performance.now();
        this.particles = this.particles.filter(p => now < p.end);

        for (const p of this.particles) {
            const t = Math.min(1, (now - p.start) / (p.end - p.start));
            ctx.globalAlpha = 1 - t * (p.type === 'projectile' ? 0.3 : 1.0);
            
            // Only use shadow if it's a projectile or early in flash lifecycle for performance
            const useShadow = (p.type === 'projectile') || (t < 0.5);
            if (useShadow) {
                ctx.shadowBlur = p.type === 'projectile' ? 14 : 18;
                ctx.shadowColor = p.color;
            } else {
                ctx.shadowBlur = 0;
            }

            if (p.type === 'projectile') {
                const x = p.x0 + (p.x1 - p.x0) * t;
                const y = p.y0 + (p.y1 - p.y0) * t;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.ellipse(x, y, 6, 3, Math.atan2(p.y1 - p.y0, p.x1 - p.x0), 0, Math.PI * 2);
                ctx.fill();
            } else if (p.type === 'flash') {
                const radius = 4 + t * 16;
                ctx.strokeStyle = p.color;
                ctx.lineWidth = 3 * (1 - t) + 1;
                ctx.beginPath();
                ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
        // Reset state for next call
        ctx.globalAlpha = 1.0;
        ctx.shadowBlur = 0;
    }

    // ── Spawn effect (called from game.js per attack) ────────
    fireProjectile(attacker, target) {
        if (!attacker || !target) return;
        const cw = this._cw, ch = this._ch;
        const x0 = (attacker.x + 0.5) * cw, y0 = (attacker.y + 0.5) * ch;
        const x1 = (target.x   + 0.5) * cw, y1 = (target.y   + 0.5) * ch;
        const now = performance.now();

        if (attacker.range <= 1) {
            this.particles.push({ type: 'flash', color: attacker.color, x: x1, y: y1, start: now, end: now + 260 });
        } else {
            const dist = Math.hypot(x1 - x0, y1 - y0);
            const dur  = Math.max(120, dist * 1.1);
            this.particles.push({ type: 'projectile', color: attacker.color, x0, y0, x1, y1, start: now, end: now + dur });
            this.particles.push({ type: 'flash', color: attacker.color, x: x1, y: y1, start: now + dur, end: now + dur + 220 });
        }
    }

    // ── Unit DOM (cached — only create/destroy, never rebuild) ─
    renderUnits(units, phase) {
        if (this._cw === 0) this._syncCanvasSize();
        const alive = new Set();

        units.forEach(unit => {
            if (!unit.isAlive()) return;
            if (unit._uiId === undefined) unit._uiId = this.unitIdCounter++;
            alive.add(unit._uiId);

            let cached = this.unitEls.get(unit._uiId);

            if (!cached) {
                // Create once
                const el = document.createElement('div');
                el.className = 'unit';
                el.style.color = unit.color;
                
                const body = document.createElement('div');
                body.className = 'unit-body';
                body.textContent = unit.icon;

                const hpBar  = document.createElement('div');
                hpBar.className = 'hp-bar';
                const hpFill = document.createElement('div');
                hpFill.className = 'hp-fill';
                hpBar.appendChild(hpFill);
                
                el.appendChild(body);
                el.appendChild(hpBar);

                this.unitLayer.appendChild(el);
                cached = { el, hpFill, lastX: -1, lastY: -1 };
                this.unitEls.set(unit._uiId, cached);
            }

            if (cached.lastX !== unit.x || cached.lastY !== unit.y) {
                const tx = unit.x * this._cw;
                const ty = unit.y * this._ch;
                cached.el.style.transform = `translate(${tx}px, ${ty}px)`;
                cached.lastX = unit.x;
                cached.lastY = unit.y;
            }

            cached.el.classList.toggle('scouted',   phase === 'SCOUT' && unit.team === 'enemy');
            cached.el.classList.toggle('attacking', !!unit.isAttacking);

            const pct = Math.round((unit.hp / unit.maxHp) * 100);
            const cur = parseFloat(cached.hpFill.style.width) || 100;
            if (Math.abs(cur - pct) > 0.5) cached.hpFill.style.width = pct + '%';
        });

        // Remove elements for dead/removed units
        for (const [id, cached] of this.unitEls) {
            if (!alive.has(id)) {
                cached.el.remove();
                this.unitEls.delete(id);
            }
        }
    }

    // ── Shop ────────────────────────────────────────────────
    renderShop(shopUnits, playerGold, selectedIndex, phase) {
        // Quick shallow check to avoid DOM thrashing
        const stateStr = JSON.stringify(shopUnits);
        if (this.lastShopState.units === stateStr && 
            this.lastShopState.gold === playerGold && 
            this.lastShopState.index === selectedIndex &&
            this.lastShopState.phase === phase) {
            return;
        }
        this.lastShopState = { units: stateStr, gold: playerGold, index: selectedIndex, phase: phase };

        this.shopItems.innerHTML = '';
        shopUnits.forEach((unitKey, index) => {
            if (!unitKey) {
                const empty = document.createElement('div');
                empty.className = 'shop-item disabled';
                empty.textContent = 'SOLD OUT';
                this.shopItems.appendChild(empty);
                return;
            }
            const config = UNIT_TYPES[unitKey];
            const item = document.createElement('div');
            item.className = 'shop-item';
            if (playerGold >= config.cost) item.classList.add('affordable');
            if (index === selectedIndex) item.classList.add('selected');
            if (phase === 'SCOUT') item.classList.add('disabled');
            item.innerHTML = `
                <span>${config.icon} ${config.name}</span>
                <span>${config.cost} 🪙</span>
                <div class="tooltip">
                    <strong>${config.name}</strong><br>
                    HP: ${config.hp} | DMG: ${config.damage}<br>
                    Range: ${config.range}
                </div>`;
            item.addEventListener('click', () => this.game.buyFromShop(index));
            this.shopItems.appendChild(item);
        });
    }

    highlightPlayerZone(highlight) {
        document.querySelectorAll('.player-zone').forEach(c => c.classList.toggle('highlight', highlight));
    }

    updateStats(gold, round) {
        this.goldValue.textContent = gold;
        this.roundValue.textContent = round;
    }

    showOverlay(text, goldEarned) {
        this.resultText.textContent = text;
        const sub = document.getElementById('result-sub');
        if (sub) sub.textContent = `+${goldEarned} 🪙 earned`;
        this.overlay.classList.remove('hidden');
    }

    hideOverlay() {
        this.overlay.classList.add('hidden');
    }
}
