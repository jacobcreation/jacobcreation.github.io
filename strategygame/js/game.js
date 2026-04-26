import { 
    GRID_SIZE, 
    UNIT_TYPES, 
    TICK_RATE, 
    INITIAL_GOLD, 
    WIN_GOLD, 
    LOSS_GOLD, 
    REROLL_COST, 
    SHOP_SIZE 
} from './constants.js';
import { Unit } from './unit.js';
import { UI } from './ui.js';

class Game {
    constructor() {
        this.gold = INITIAL_GOLD;
        this.round = 1;
        this.phase = 'PREP'; // 'PREP', 'BATTLE', 'GAMEOVER'
        this.units = []; // All units on board
        this.shopUnits = [];
        this.selectedShopIndex = null;
        
        this.ui = new UI(this);
        this.battleInterval = null;

        this.init();
    }

    init() {
        this.rerollShop();
        this.updateUI();
        
        document.getElementById('reroll-btn').addEventListener('click', () => this.rerollShop(true));
        document.getElementById('start-battle-btn').addEventListener('click', () => this.startBattle());
        document.getElementById('next-round-btn').addEventListener('click', () => this.nextRound());
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
            if (!this.shopUnits.includes(randomKey)) {
                this.shopUnits.push(randomKey);
            }
        }
        this.updateUI();
    }

    buyFromShop(index) {
        if (this.phase !== 'PREP') return;
        
        // If clicking the same item, deselect it
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

        // If something was selected from shop, try to place it
        if (this.selectedShopIndex !== null) {
            const unitKey = this.shopUnits[this.selectedShopIndex];
            const config = UNIT_TYPES[unitKey];

            // Player zone check (bottom half)
            if (y < GRID_SIZE / 2) {
                return;
            }

            // Occupancy check
            if (this.units.some(u => u.x === x && u.y === y)) {
                return;
            }

            // Place unit
            const newUnit = new Unit(unitKey, config, x, y, 'player');
            this.units.push(newUnit);
            this.gold -= config.cost;
            this.shopUnits[this.selectedShopIndex] = null;
            this.selectedShopIndex = null;
            this.ui.highlightPlayerZone(false);
            this.updateUI();
        } else {
            // If clicking an existing unit, maybe sell it? (Optional feature)
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
        // Simple scaling: more units or stronger units as rounds progress
        const enemyCount = Math.min(2 + Math.floor(this.round / 2), 10);
        const types = Object.keys(UNIT_TYPES);
        const maxAttempts = 100;

        for (let i = 0; i < enemyCount; i++) {
            const typeKey = types[Math.floor(Math.random() * types.length)];
            const config = UNIT_TYPES[typeKey];
            
            let x, y;
            let attempts = 0;
            let placed = false;
            
            while (attempts < maxAttempts && !placed) {
                x = Math.floor(Math.random() * GRID_SIZE);
                y = Math.floor(Math.random() * (GRID_SIZE / 2));
                
                if (!this.units.some(u => u.x === x && u.y === y)) {
                    this.units.push(new Unit(typeKey, config, x, y, 'enemy'));
                    placed = true;
                }
                attempts++;
            }
            
            // If we couldn't place after max attempts, skip this enemy
            if (!placed) {
                console.warn(`Could not place enemy unit ${i} after ${maxAttempts} attempts`);
            }
        }
    }

    startBattle() {
        if (this.phase !== 'PREP') return;
        if (!this.units.some(u => u.team === 'player')) {
            alert("Place at least one unit!");
            return;
        }

        this.spawnEnemies();
        this.phase = 'BATTLE';
        document.getElementById('start-battle-btn').disabled = true;
        document.getElementById('reroll-btn').disabled = true;

        this.battleInterval = setInterval(() => this.battleTick(), TICK_RATE);
    }

    battleTick() {
        // Shuffle units to avoid order bias using Fisher-Yates algorithm
        const shuffledUnits = [...this.units];
        for (let i = shuffledUnits.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledUnits[i], shuffledUnits[j]] = [shuffledUnits[j], shuffledUnits[i]];
        }
        
        shuffledUnits.forEach(unit => {
            unit.step(this.units, GRID_SIZE);
        });

        this.updateUI();
        this.checkBattleEnd();
    }

    checkBattleEnd() {
        const playerAlive = this.units.some(u => u.team === 'player' && u.isAlive());
        const enemyAlive = this.units.some(u => u.team === 'enemy' && u.isAlive());

        if (!playerAlive || !enemyAlive) {
            clearInterval(this.battleInterval);
            const won = playerAlive;
            this.endBattle(won);
        }
    }

    endBattle(won) {
        this.phase = 'GAMEOVER';
        const reward = won ? WIN_GOLD : LOSS_GOLD;
        this.gold += reward;
        
        this.ui.showOverlay(won ? "VICTORY" : "DEFEAT");
    }

    nextRound() {
        this.round++;
        this.phase = 'PREP';
        // Remove dead units, reset health of survivors
        this.units = this.units.filter(u => u.team === 'player' && u.isAlive());
        this.units.forEach(u => u.hp = u.maxHp);
        
        this.rerollShop();
        this.ui.hideOverlay();
        document.getElementById('start-battle-btn').disabled = false;
        document.getElementById('reroll-btn').disabled = false;
        this.updateUI();
    }

    updateUI() {
        this.ui.updateStats(this.gold, this.round);
        this.ui.renderShop(this.shopUnits, this.gold, this.selectedShopIndex);
        this.ui.renderUnits(this.units);
    }
}

// Start the game
window.addEventListener('DOMContentLoaded', () => {
    new Game();
});
