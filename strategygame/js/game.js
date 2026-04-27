import {
    GRID_SIZE,
    UNIT_TYPES,
    TICK_RATE,
    INITIAL_GOLD,
    ROUND_INCOME,
    WIN_GOLD,
    LOSS_GOLD,
    REROLL_COST,
    SHOP_SIZE,
    SCOUT_DURATION
} from './constants.js';
import { Unit } from './unit.js';
import { UI } from './ui.js';

class Game {
    constructor() {
        this.gold = INITIAL_GOLD;
        this.round = 1;
        this.phase = 'SCOUT'; // 'SCOUT', 'PREP', 'BATTLE', 'GAMEOVER'
        this.units = [];
        this.shopUnits = [];
        this.selectedShopIndex = null;
        this.scoutCountdown = null;

        this.ui = new UI(this);
        this.battleInterval = null;

        this.init();
    }

    init() {
        this.spawnEnemies();
        this.rerollShop();
        this.updateUI();

        document.getElementById('reroll-btn').addEventListener('click', () => this.rerollShop(true));
        document.getElementById('start-battle-btn').addEventListener('click', () => this.startBattle());
        document.getElementById('next-round-btn').addEventListener('click', () => this.nextRound());
        document.getElementById('skip-scout-btn').addEventListener('click', () => this.endScoutPhase());

        this.startScoutPhase();
    }

    startScoutPhase() {
        this.phase = 'SCOUT';
        document.getElementById('start-battle-btn').disabled = true;
        document.getElementById('reroll-btn').disabled = true;
        document.getElementById('skip-scout-btn').classList.remove('hidden');
        document.getElementById('scout-banner').classList.remove('hidden');

        let timeLeft = SCOUT_DURATION / 1000;
        document.getElementById('scout-timer').textContent = timeLeft;

        this.scoutCountdown = setInterval(() => {
            timeLeft--;
            document.getElementById('scout-timer').textContent = timeLeft;
            if (timeLeft <= 0) {
                this.endScoutPhase();
            }
        }, 1000);
    }

    endScoutPhase() {
        clearInterval(this.scoutCountdown);
        this.phase = 'PREP';
        document.getElementById('start-battle-btn').disabled = false;
        document.getElementById('reroll-btn').disabled = false;
        document.getElementById('skip-scout-btn').classList.add('hidden');
        document.getElementById('scout-banner').classList.add('hidden');
        this.updateUI();
    }

    rerollShop(isManual = false) {
        if (isManual) {
            if (this.gold < REROLL_COST) return;
            this.gold -= REROLL_COST;
        }

        const keys = Object.keys(UNIT_TYPES);
        this.shopUnits = [];

        while (this.shopUnits.length < SHOP_SIZE) {
            const randomKey = keys[Math.floor(Math.random() * keys.length)];
            this.shopUnits.push(randomKey);
        }
        this.updateUI();
    }

    buyFromShop(index) {
        if (this.phase !== 'PREP') return;

        if (this.selectedShopIndex === index) {
            this.selectedShopIndex = null;
            this.ui.highlightPlayerZone(false);
        } else {
            const unitKey = this.shopUnits[index];
            if (!unitKey) return;
            const config = UNIT_TYPES[unitKey];
            if (this.gold >= config.cost) {
                this.selectedShopIndex = index;
                this.ui.highlightPlayerZone(true);
            }
        }
        this.updateUI();
    }

    handleCellClick(x, y) {
        if (this.phase !== 'PREP') return;

        if (this.selectedShopIndex !== null) {
            const unitKey = this.shopUnits[this.selectedShopIndex];
            const config = UNIT_TYPES[unitKey];

            if (y < GRID_SIZE / 2) return;
            if (this.units.some(u => u.x === x && u.y === y)) return;

            const newUnit = new Unit(unitKey, config, x, y, 'player');
            this.units.push(newUnit);
            this.gold -= config.cost;
            this.shopUnits[this.selectedShopIndex] = null;
            this.selectedShopIndex = null;
            this.ui.highlightPlayerZone(false);
            this.updateUI();
        } else {
            const unitIndex = this.units.findIndex(u => u.x === x && u.y === y);
            if (unitIndex !== -1 && this.units[unitIndex].team === 'player') {
                const unit = this.units[unitIndex];
                const refund = Math.floor(UNIT_TYPES[unit.typeKey].cost * 0.75);
                this.gold += refund;
                this.units.splice(unitIndex, 1);
                this.updateUI();
            }
        }
    }

    spawnEnemies() {
        const enemyCount = Math.min(2 + Math.floor(this.round / 2), 10);
        const types = Object.keys(UNIT_TYPES);
        const maxAttempts = 100;

        for (let i = 0; i < enemyCount; i++) {
            const typeKey = types[Math.floor(Math.random() * types.length)];
            const config = UNIT_TYPES[typeKey];

            let x, y, attempts = 0, placed = false;
            while (attempts < maxAttempts && !placed) {
                x = Math.floor(Math.random() * GRID_SIZE);
                y = Math.floor(Math.random() * (GRID_SIZE / 2));
                if (!this.units.some(u => u.x === x && u.y === y)) {
                    this.units.push(new Unit(typeKey, config, x, y, 'enemy'));
                    placed = true;
                }
                attempts++;
            }
        }
    }

    startBattle() {
        if (this.phase !== 'PREP') return;
        if (!this.units.some(u => u.team === 'player')) {
            alert("Place at least one unit!");
            return;
        }

        this.phase = 'BATTLE';
        document.getElementById('start-battle-btn').disabled = true;
        document.getElementById('reroll-btn').disabled = true;

        this.battleInterval = setInterval(() => this.battleTick(), TICK_RATE);
    }

    battleTick() {
        const shuffledUnits = [...this.units];
        for (let i = shuffledUnits.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledUnits[i], shuffledUnits[j]] = [shuffledUnits[j], shuffledUnits[i]];
        }

        const attackEvents = [];
        shuffledUnits.forEach(unit => {
            const result = unit.step(this.units, GRID_SIZE);
            if (result && result.type === 'attack') {
                attackEvents.push(result);
            }
        });

        this.updateUI();

        // Fire projectile visuals for each attack
        attackEvents.forEach(ev => {
            this.ui.fireProjectile(ev.attacker, ev.target);
        });

        this.checkBattleEnd();
    }

    checkBattleEnd() {
        const playerAlive = this.units.some(u => u.team === 'player' && u.isAlive());
        const enemyAlive = this.units.some(u => u.team === 'enemy' && u.isAlive());

        if (!playerAlive || !enemyAlive) {
            clearInterval(this.battleInterval);
            this.endBattle(playerAlive);
        }
    }

    endBattle(won) {
        this.phase = 'GAMEOVER';
        const reward = won ? WIN_GOLD : LOSS_GOLD;
        this.gold += reward;
        this.ui.showOverlay(won ? "VICTORY" : "DEFEAT", reward);
    }

    nextRound() {
        this.round++;
        this.phase = 'SCOUT';
        this.units = this.units.filter(u => u.team === 'player' && u.isAlive());
        this.units.forEach(u => u.hp = u.maxHp);

        // Round income
        this.gold += ROUND_INCOME;

        this.spawnEnemies();
        this.rerollShop();
        this.ui.hideOverlay();
        document.getElementById('start-battle-btn').disabled = false;
        document.getElementById('reroll-btn').disabled = false;
        this.updateUI();
        this.startScoutPhase();
    }

    updateUI() {
        this.ui.updateStats(this.gold, this.round);
        this.ui.renderShop(this.shopUnits, this.gold, this.selectedShopIndex, this.phase);
        this.ui.renderUnits(this.units, this.phase);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new Game();
});
