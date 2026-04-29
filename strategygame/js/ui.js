import { GRID_SIZE, PLAYER_ZONE_START, UNIT_TYPES } from './constants.js';

export class UI {
    constructor(game) {
        this.game = game;
        this.gridContainer = document.getElementById('grid-container');
        this.shopItems = document.getElementById('shop-items');
        this.goldValue = document.getElementById('gold-value');
        this.roundValue = document.getElementById('round-value');
        this.phaseValue = document.getElementById('phase-value');
        this.speedValue = document.getElementById('speed-value');
        this.phaseCallout = document.getElementById('phase-callout');
        this.phaseBanner = document.getElementById('phase-banner');
        this.bannerTitle = document.getElementById('banner-title');
        this.bannerSub = document.getElementById('banner-sub');
        this.scoutTimer = document.getElementById('scout-timer');
        this.phasePill = document.getElementById('phase-pill');
        this.prepInstructions = document.getElementById('prep-instructions');
        this.logStatus = document.getElementById('log-status');
        this.enemySummary = document.getElementById('enemy-summary');
        this.enemyRoster = document.getElementById('enemy-roster');
        this.playerSummary = document.getElementById('player-summary');
        this.cellInfo = document.getElementById('cell-info');
        this.actionHint = document.getElementById('action-hint');
        this.unitInspector = document.getElementById('unit-inspector');
        this.inspectorBadge = document.getElementById('inspector-badge');
        this.battleLog = document.getElementById('battle-log');
        this.shopStatus = document.getElementById('shop-status');
        this.overlay = document.getElementById('overlay');
        this.overlayContent = document.getElementById('overlay-content');
        this.resultText = document.getElementById('result-text');
        this.resultSub = document.getElementById('result-sub');
        this.overlaySummary = document.getElementById('overlay-summary');
        this.startBattleBtn = document.getElementById('start-battle-btn');
        this.pauseBattleBtn = document.getElementById('pause-battle-btn');
        this.skipScoutBtn = document.getElementById('skip-scout-btn');
        this.rerollBtn = document.getElementById('reroll-btn');
        this.lockShopBtn = document.getElementById('lock-shop-btn');
        this.sellUnitBtn = document.getElementById('sell-unit-btn');
        this.autoArrangeBtn = document.getElementById('auto-arrange-btn');
        this.speedButtons = Array.from(document.querySelectorAll('[data-speed]'));

        this.canvas = document.createElement('canvas');
        this.canvas.className = 'fx-layer';
        this.ctx = this.canvas.getContext('2d');
        this.unitLayer = document.createElement('div');
        this.unitLayer.className = 'unit-layer';
        this.particles = [];
        this.unitEls = new Map();
        this.lastShopSignature = '';
        this.cells = new Map();
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
                const key = `${x},${y}`;
                cell.className = 'grid-cell';
                cell.classList.add(y >= PLAYER_ZONE_START ? 'player-zone' : 'enemy-zone');
                cell.dataset.x = x;
                cell.dataset.y = y;
                cell.dataset.key = key;
                cell.addEventListener('click', () => this.game.handleCellClick(x, y));
                cell.addEventListener('mouseenter', () => this.game.handleCellHover(x, y));
                cell.addEventListener('mouseleave', () => this.game.clearHoveredCell(x, y));
                this.cells.set(key, cell);
                this.gridContainer.appendChild(cell);
            }
        }

        this.gridContainer.appendChild(this.unitLayer);
        this.gridContainer.appendChild(this.canvas);
        this._syncCanvasSize();
        new ResizeObserver(() => this._syncCanvasSize()).observe(this.gridContainer);
    }

    _syncCanvasSize() {
        const width = this.gridContainer.clientWidth;
        const height = this.gridContainer.clientHeight;

        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width;
            this.canvas.height = height;
            this._cw = width / GRID_SIZE;
            this._ch = height / GRID_SIZE;
        }
    }

    startRenderLoop() {
        let needsClear = false;

        const loop = () => {
            requestAnimationFrame(loop);

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
        this.particles = this.particles.filter(particle => now < particle.end);

        for (const particle of this.particles) {
            const t = Math.min(1, (now - particle.start) / (particle.end - particle.start));
            ctx.globalAlpha = 1 - t * (particle.type === 'projectile' ? 0.3 : 1);
            ctx.shadowBlur = particle.type === 'projectile' ? 16 : 20;
            ctx.shadowColor = particle.color;

            if (particle.type === 'projectile') {
                const x = particle.x0 + (particle.x1 - particle.x0) * t;
                const y = particle.y0 + (particle.y1 - particle.y0) * t;
                ctx.fillStyle = particle.color;
                ctx.beginPath();
                ctx.ellipse(x, y, 7, 3, Math.atan2(particle.y1 - particle.y0, particle.x1 - particle.x0), 0, Math.PI * 2);
                ctx.fill();
            } else {
                const radius = 6 + t * 18;
                ctx.strokeStyle = particle.color;
                ctx.lineWidth = 3 * (1 - t) + 1;
                ctx.beginPath();
                ctx.arc(particle.x, particle.y, radius, 0, Math.PI * 2);
                ctx.stroke();
            }
        }

        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
    }

    fireProjectile(attacker, target) {
        if (!attacker || !target) return;

        const x0 = (attacker.x + 0.5) * this._cw;
        const y0 = (attacker.y + 0.5) * this._ch;
        const x1 = (target.x + 0.5) * this._cw;
        const y1 = (target.y + 0.5) * this._ch;
        const now = performance.now();
        const color = attacker.team === 'player' ? '#7fe0ff' : '#ff8d7c';

        if (attacker.range <= 1) {
            this.particles.push({
                type: 'flash',
                color,
                x: x1,
                y: y1,
                start: now,
                end: now + 240
            });
            return;
        }

        const dist = Math.hypot(x1 - x0, y1 - y0);
        const duration = Math.max(140, dist * 1.05);
        this.particles.push({
            type: 'projectile',
            color,
            x0,
            y0,
            x1,
            y1,
            start: now,
            end: now + duration
        });
        this.particles.push({
            type: 'flash',
            color,
            x: x1,
            y: y1,
            start: now + duration,
            end: now + duration + 200
        });
    }

    render(state) {
        this._syncCanvasSize();
        this.renderHud(state);
        this.renderControls(state);
        this.renderSummaries(state);
        this.renderBoardState(state);
        this.renderUnits(state.units, state);
        this.renderInspector(state);
        this.renderLog(state.logEntries, state.phase);
        this.renderShop(state.shopUnits, state);
        this.renderCellInfo(state);
    }

    renderHud(state) {
        const { phaseMeta } = state;
        this.goldValue.textContent = state.gold;
        this.roundValue.textContent = state.round;
        this.phaseValue.textContent = phaseMeta.label;
        this.speedValue.textContent = `${state.battleSpeed}x`;
        this.phaseCallout.textContent = phaseMeta.description;
        this.bannerTitle.textContent = phaseMeta.title;
        this.bannerSub.textContent = phaseMeta.description;
        this.phaseBanner.dataset.tone = phaseMeta.tone;
        this.phaseBanner.classList.toggle('show-countdown', state.phase === 'SCOUT');
        this.scoutTimer.textContent = state.phase === 'SCOUT' ? `${state.scoutSecondsLeft}s` : '--';
        this.phasePill.textContent = phaseMeta.label.toUpperCase();
        this.phasePill.className = `phase-pill ${phaseMeta.tone}`;
        this.prepInstructions.textContent = state.actionHint;

        this.speedButtons.forEach(button => {
            const isActive = Number(button.dataset.speed) === state.battleSpeed;
            button.classList.toggle('active', isActive);
        });
    }

    renderControls(state) {
        this.startBattleBtn.disabled = !state.canStartBattle;
        this.pauseBattleBtn.disabled = !state.canPauseBattle;
        this.pauseBattleBtn.textContent = state.isBattlePaused ? 'Resume Battle' : 'Pause Battle';
        this.skipScoutBtn.classList.toggle('hidden', state.phase !== 'SCOUT');
        this.rerollBtn.disabled = !state.canReroll;
        this.sellUnitBtn.disabled = !state.canSellSelected;
        this.autoArrangeBtn.disabled = !state.canAutoArrange;
        this.lockShopBtn.classList.toggle('is-locked', state.shopLocked);
        this.lockShopBtn.textContent = state.shopLocked ? 'Shop Locked' : 'Lock Shop';
        this.shopStatus.textContent = state.shopStatus;
    }

    renderSummaries(state) {
        this.enemySummary.innerHTML = this.createSummaryMarkup(state.enemySummary, 'Enemy');
        this.playerSummary.innerHTML = this.createSummaryMarkup(state.playerSummary, 'Allies');
        this.enemyRoster.innerHTML = this.createRosterMarkup(state.enemySummary.roster);
    }

    createSummaryMarkup(summary, label) {
        return `
            <div class="summary-card">
                <span>${label} Units</span>
                <strong>${summary.count}</strong>
            </div>
            <div class="summary-card">
                <span>Health</span>
                <strong>${summary.totalHp}/${summary.totalMaxHp}</strong>
            </div>
            <div class="summary-card">
                <span>Split</span>
                <strong>${summary.melee} melee / ${summary.ranged} ranged</strong>
            </div>
            <div class="summary-card">
                <span>Threat</span>
                <strong>${summary.threat}</strong>
            </div>
            <div class="summary-wide">
                <span>Army Snapshot</span>
                <strong>${summary.totalDamage} total damage | ${summary.totalValue} gold value</strong>
                <div class="summary-footnote">${summary.kills} kills landed • ${summary.damageDealt} damage dealt so far</div>
            </div>
        `;
    }

    createRosterMarkup(roster) {
        if (!roster.length) {
            return '<div class="empty-state">No units are currently active on this side of the board.</div>';
        }

        return roster.map(unit => `
            <div class="roster-row">
                <div class="roster-main">
                    <span class="roster-icon">${unit.icon}</span>
                    <div>
                        <strong>${unit.name}</strong>
                        <p>${unit.role}</p>
                    </div>
                </div>
                <div class="roster-meta">
                    x${unit.count}
                    <small>${unit.totalCost} gold</small>
                </div>
            </div>
        `).join('');
    }

    renderBoardState(state) {
        const aliveUnitMap = new Map(
            state.units
                .filter(unit => unit.isAlive())
                .map(unit => [`${unit.x},${unit.y}`, unit])
        );

        this.cells.forEach((cell, key) => {
            const [x, y] = key.split(',').map(Number);
            const occupant = aliveUnitMap.get(key);
            const selectedUnit = state.selectedUnit;
            const canPlace = state.phase === 'PREP' && state.selectedShopIndex !== null && y >= PLAYER_ZONE_START && !occupant;
            const canMove = state.phase === 'PREP' &&
                state.selectedShopIndex === null &&
                selectedUnit &&
                selectedUnit.team === 'player' &&
                y >= PLAYER_ZONE_START &&
                !occupant;

            cell.classList.toggle('occupied', !!occupant);
            cell.classList.toggle('occupied-player', occupant?.team === 'player');
            cell.classList.toggle('occupied-enemy', occupant?.team === 'enemy');
            cell.classList.toggle('hovered', state.hoveredCell?.x === x && state.hoveredCell?.y === y);
            cell.classList.toggle('selected-cell', selectedUnit?.x === x && selectedUnit?.y === y);
            cell.classList.toggle('placement-target', canPlace);
            cell.classList.toggle('move-target', canMove);
        });
    }

    renderUnits(units, state) {
        const aliveIds = new Set();
        const hoveredId = state.hoveredUnit?.id ?? null;

        units.forEach(unit => {
            if (!unit.isAlive()) return;

            aliveIds.add(unit.id);
            let cached = this.unitEls.get(unit.id);

            if (!cached) {
                const el = document.createElement('div');
                el.className = 'unit';

                const shell = document.createElement('div');
                shell.className = 'unit-shell';

                const teamChip = document.createElement('span');
                teamChip.className = 'unit-team-chip';

                const statTag = document.createElement('span');
                statTag.className = 'unit-stat-tag';

                const body = document.createElement('div');
                body.className = 'unit-body';

                const icon = document.createElement('span');
                icon.className = 'unit-icon';

                const hpBar = document.createElement('div');
                hpBar.className = 'hp-bar';
                const hpFill = document.createElement('div');
                hpFill.className = 'hp-fill';
                hpBar.appendChild(hpFill);

                body.appendChild(icon);
                shell.append(teamChip, statTag, body, hpBar);
                el.appendChild(shell);
                this.unitLayer.appendChild(el);

                cached = {
                    el,
                    icon,
                    hpFill,
                    teamChip,
                    statTag,
                    lastX: -1,
                    lastY: -1
                };

                this.unitEls.set(unit.id, cached);
            }

            cached.icon.textContent = unit.icon;
            cached.teamChip.textContent = unit.team === 'player' ? 'ALLY' : 'FOE';
            cached.statTag.textContent = unit.range > 1 ? `R${unit.range}` : 'MELEE';
            cached.el.style.setProperty('--unit-accent', unit.color);
            cached.el.classList.toggle('player-team', unit.team === 'player');
            cached.el.classList.toggle('enemy-team', unit.team === 'enemy');
            cached.el.classList.toggle('selected', state.selectedUnitId === unit.id);
            cached.el.classList.toggle('hovered', hoveredId === unit.id);
            cached.el.classList.toggle('scouted', state.phase === 'SCOUT' && unit.team === 'enemy');
            cached.el.classList.toggle('attacking', !!unit.isAttacking);

            if (cached.lastX !== unit.x || cached.lastY !== unit.y) {
                const tx = unit.x * this._cw;
                const ty = unit.y * this._ch;
                cached.el.style.transform = `translate(${tx}px, ${ty}px)`;
                cached.lastX = unit.x;
                cached.lastY = unit.y;
            }

            cached.hpFill.style.width = `${Math.max(0, Math.round((unit.hp / unit.maxHp) * 100))}%`;
        });

        for (const [id, cached] of this.unitEls) {
            if (!aliveIds.has(id)) {
                cached.el.remove();
                this.unitEls.delete(id);
            }
        }
    }

    renderInspector(state) {
        const inspectedUnit = state.selectedUnit || state.hoveredUnit;
        const selectedRecruit = state.selectedRecruit;

        if (inspectedUnit) {
            const badgeClass = inspectedUnit.team === 'player' ? 'player' : 'enemy';
            this.inspectorBadge.textContent = inspectedUnit.team === 'player' ? 'Ally Unit' : 'Enemy Unit';
            this.inspectorBadge.className = `badge-subtle ${badgeClass}`;
            this.unitInspector.innerHTML = `
                <div class="inspector-hero">
                    <span class="inspector-icon">${inspectedUnit.icon}</span>
                    <div class="inspector-title">
                        <strong>${inspectedUnit.name}</strong>
                        <p>${inspectedUnit.role} • ${inspectedUnit.team === 'player' ? 'Ally' : 'Enemy'}</p>
                    </div>
                </div>
                <p class="inspector-description">${inspectedUnit.description}</p>
                <div class="inspector-stats">
                    <div class="inspector-stat"><span>Position</span><strong>${this.game.getCellLabel(inspectedUnit.x, inspectedUnit.y)}</strong></div>
                    <div class="inspector-stat"><span>Health</span><strong>${inspectedUnit.hp}/${inspectedUnit.maxHp}</strong></div>
                    <div class="inspector-stat"><span>Damage</span><strong>${inspectedUnit.damage}</strong></div>
                    <div class="inspector-stat"><span>Range</span><strong>${inspectedUnit.range}</strong></div>
                    <div class="inspector-stat"><span>Attack Delay</span><strong>${inspectedUnit.speed}</strong></div>
                    <div class="inspector-stat"><span>Value</span><strong>${inspectedUnit.cost} gold</strong></div>
                    <div class="inspector-stat"><span>Kills</span><strong>${inspectedUnit.kills}</strong></div>
                    <div class="inspector-stat"><span>Damage Dealt</span><strong>${inspectedUnit.damageDealt}</strong></div>
                </div>
            `;
            return;
        }

        if (selectedRecruit) {
            this.inspectorBadge.textContent = 'Shop Preview';
            this.inspectorBadge.className = 'badge-subtle';
            this.unitInspector.innerHTML = `
                <div class="inspector-hero">
                    <span class="inspector-icon">${selectedRecruit.icon}</span>
                    <div class="inspector-title">
                        <strong>${selectedRecruit.name}</strong>
                        <p>${selectedRecruit.role} • Recruit Preview</p>
                    </div>
                </div>
                <p class="inspector-description">${selectedRecruit.description}</p>
                <div class="inspector-stats">
                    <div class="inspector-stat"><span>Cost</span><strong>${selectedRecruit.cost} gold</strong></div>
                    <div class="inspector-stat"><span>Health</span><strong>${selectedRecruit.hp}</strong></div>
                    <div class="inspector-stat"><span>Damage</span><strong>${selectedRecruit.damage}</strong></div>
                    <div class="inspector-stat"><span>Range</span><strong>${selectedRecruit.range}</strong></div>
                    <div class="inspector-stat"><span>Attack Delay</span><strong>${selectedRecruit.speed}</strong></div>
                    <div class="inspector-stat"><span>Preferred Band</span><strong>${selectedRecruit.preferredBand}</strong></div>
                </div>
            `;
            return;
        }

        if (state.hoveredCell) {
            const zone = state.hoveredCell.y >= PLAYER_ZONE_START ? 'Ally Zone' : 'Enemy Zone';
            this.inspectorBadge.textContent = 'Cell Data';
            this.inspectorBadge.className = 'badge-subtle';
            this.unitInspector.innerHTML = `
                <div class="empty-state">
                    ${this.game.getCellLabel(state.hoveredCell.x, state.hoveredCell.y)} sits in the ${zone}. Hover or click a unit for combat stats, or select a recruit to see deployment instructions here.
                </div>
            `;
            return;
        }

        this.inspectorBadge.textContent = 'No Selection';
        this.inspectorBadge.className = 'badge-subtle';
        this.unitInspector.innerHTML = `
            <div class="empty-state">
                Click any recruit, ally, or enemy on the board to inspect it. During prep you can also select an ally, then click an empty ally tile to move it instead of selling it by accident.
            </div>
        `;
    }

    renderLog(entries, phase) {
        this.logStatus.textContent = phase === 'BATTLE' ? 'Live' : 'Recent';

        if (!entries.length) {
            this.battleLog.innerHTML = '<div class="empty-state">Battle updates will appear here as you recruit, reposition, and fight.</div>';
            return;
        }

        this.battleLog.innerHTML = entries.map(entry => `
            <div class="log-entry ${entry.tone}">
                <strong>Round ${entry.round}</strong>
                <p>${entry.message}</p>
            </div>
        `).join('');
    }

    renderShop(shopUnits, state) {
        const signature = JSON.stringify({
            shopUnits,
            gold: state.gold,
            selectedIndex: state.selectedShopIndex,
            phase: state.phase,
            locked: state.shopLocked
        });

        if (signature === this.lastShopSignature) return;
        this.lastShopSignature = signature;

        this.shopItems.innerHTML = '';

        shopUnits.forEach((unitKey, index) => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'shop-item';

            if (!unitKey) {
                item.classList.add('disabled', 'sold-out');
                item.disabled = true;
                item.innerHTML = `
                    <div class="shop-top">
                        <div class="shop-main">
                            <span class="shop-icon">—</span>
                            <div>
                                <strong class="shop-name">Sold Out</strong>
                                <p class="shop-role">Slot spent this round</p>
                            </div>
                        </div>
                        <span class="shop-cost">0</span>
                    </div>
                    <p class="shop-description">Reroll or advance the round to refresh this slot.</p>
                    <div class="shop-footer">No recruit available.</div>
                `;
                this.shopItems.appendChild(item);
                return;
            }

            const config = UNIT_TYPES[unitKey];
            const affordable = state.gold >= config.cost;
            const disabled = state.phase !== 'PREP' || !affordable;

            if (affordable) item.classList.add('affordable');
            if (index === state.selectedShopIndex) item.classList.add('selected');
            if (disabled) item.classList.add('disabled');

            item.innerHTML = `
                <div class="shop-top">
                    <div class="shop-main">
                        <span class="shop-icon">${config.icon}</span>
                        <div>
                            <strong class="shop-name">${config.name}</strong>
                            <p class="shop-role">${config.role}</p>
                        </div>
                    </div>
                    <span class="shop-cost">${config.cost} gold</span>
                </div>
                <p class="shop-description">${config.description}</p>
                <div class="shop-stats">
                    <span>HP ${config.hp}</span>
                    <span>DMG ${config.damage}</span>
                    <span>RNG ${config.range}</span>
                    <span>SPD ${config.speed}</span>
                </div>
                <div class="shop-footer">
                    ${index === state.selectedShopIndex
                        ? 'Recruit selected. Click an empty ally tile to deploy.'
                        : disabled
                            ? (state.phase !== 'PREP' ? 'Shop is closed until prep.' : 'Not enough gold.')
                            : 'Click to select this recruit.'}
                </div>
            `;

            item.addEventListener('click', () => this.game.buyFromShop(index));
            this.shopItems.appendChild(item);
        });
    }

    renderCellInfo(state) {
        const hoveredCell = state.hoveredCell;
        const hoveredUnit = state.hoveredUnit;
        const selectedUnit = state.selectedUnit;
        const selectedRecruit = state.selectedRecruit;

        if (hoveredCell) {
            const zone = hoveredCell.y >= PLAYER_ZONE_START ? 'Ally Zone' : 'Enemy Zone';
            const occupantText = hoveredUnit
                ? `${hoveredUnit.team === 'player' ? 'Ally' : 'Enemy'} ${hoveredUnit.name}`
                : 'Empty tile';
            const detailText = hoveredUnit
                ? `${hoveredUnit.hp}/${hoveredUnit.maxHp} HP • Range ${hoveredUnit.range} • Damage ${hoveredUnit.damage}`
                : (selectedRecruit && hoveredCell.y >= PLAYER_ZONE_START
                    ? 'Valid deployment space for the selected recruit.'
                    : 'Open ground with no unit on it.');

            this.cellInfo.innerHTML = `
                <div class="info-title">Hovered Cell</div>
                <div class="info-main">${this.game.getCellLabel(hoveredCell.x, hoveredCell.y)} • ${occupantText}</div>
                <div class="info-sub">${zone}. ${detailText}</div>
            `;
        } else {
            this.cellInfo.innerHTML = `
                <div class="info-title">Hovered Cell</div>
                <div class="info-main">Board ready</div>
                <div class="info-sub">Move over the battlefield to inspect zones, openings, and unit stats.</div>
            `;
        }

        let actionMain = state.phaseMeta.title;
        let actionSub = state.actionHint;

        if (selectedRecruit) {
            actionMain = `${selectedRecruit.name} selected`;
            actionSub = 'Click an empty ally tile to deploy the recruit immediately.';
        } else if (selectedUnit && selectedUnit.team === 'player' && state.phase === 'PREP') {
            actionMain = `${selectedUnit.name} selected`;
            actionSub = 'Click an empty ally tile to reposition, or use Sell Selected to refund part of its cost.';
        }

        this.actionHint.innerHTML = `
            <div class="info-title">Action Hint</div>
            <div class="info-main">${actionMain}</div>
            <div class="info-sub">${actionSub}</div>
        `;
    }

    showOverlay(summary) {
        this.resultText.textContent = summary.won ? 'VICTORY' : 'DEFEAT';
        this.resultSub.textContent = summary.won
            ? `Round ${summary.round} cleared. ${summary.reward} gold added to your reserves.`
            : `Round ${summary.round} lost. ${summary.reward} gold salvaged so you can rebuild.`;
        this.overlaySummary.innerHTML = `
            <div class="overlay-summary-item">
                <span>Reward</span>
                <strong>${summary.reward} gold</strong>
            </div>
            <div class="overlay-summary-item">
                <span>Allies Left</span>
                <strong>${summary.playerSurvivors}</strong>
            </div>
            <div class="overlay-summary-item">
                <span>Enemies Left</span>
                <strong>${summary.enemySurvivors}</strong>
            </div>
        `;
        this.overlayContent.classList.toggle('defeat', !summary.won);
        this.overlay.classList.remove('hidden');
    }

    hideOverlay() {
        this.overlay.classList.add('hidden');
    }
}
