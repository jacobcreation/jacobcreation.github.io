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
        
        this.initGrid();
    }

    initGrid() {
        this.gridContainer.innerHTML = '';
        for (let y = 0; y < GRID_SIZE; y++) {
            for (let x = 0; x < GRID_SIZE; x++) {
                const cell = document.createElement('div');
                cell.className = 'grid-cell';
                if (y >= GRID_SIZE / 2) {
                    cell.classList.add('player-zone');
                } else {
                    cell.classList.add('enemy-zone');
                }
                cell.dataset.x = x;
                cell.dataset.y = y;
                
                cell.addEventListener('click', () => this.game.handleCellClick(x, y));
                
                this.gridContainer.appendChild(cell);
            }
        }
    }

    renderShop(shopUnits, playerGold, selectedIndex) {
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
            
            item.innerHTML = `
                <span>${config.icon} ${config.name}</span>
                <span>${config.cost} 🪙</span>
                <div class="tooltip">
                    <strong>${config.name}</strong><br>
                    HP: ${config.hp}<br>
                    Damage: ${config.damage}<br>
                    Range: ${config.range}<br>
                    Speed: ${config.speed}
                </div>
            `;
            
            item.addEventListener('click', () => this.game.buyFromShop(index));
            this.shopItems.appendChild(item);
        });
    }

    highlightPlayerZone(highlight) {
        const cells = document.querySelectorAll('.player-zone');
        cells.forEach(cell => {
            if (highlight) {
                cell.classList.add('highlight');
            } else {
                cell.classList.remove('highlight');
            }
        });
    }

    updateStats(gold, round) {
        this.goldValue.textContent = gold;
        this.roundValue.textContent = round;
    }

    renderUnits(units) {
        // Clear previous units from DOM but keep the grid cells
        const unitElements = document.querySelectorAll('.unit');
        unitElements.forEach(el => el.remove());

        units.forEach(unit => {
            if (!unit.isAlive()) return;

            // Find the specific cell at this unit's position
            const cellIndex = unit.y * GRID_SIZE + unit.x;
            const cell = this.gridContainer.children[cellIndex];
            if (!cell) return;

            const unitEl = document.createElement('div');
            unitEl.className = 'unit';
            unitEl.style.color = unit.color;
            unitEl.textContent = unit.icon;

            // HP Bar
            const hpBar = document.createElement('div');
            hpBar.className = 'hp-bar';
            const hpFill = document.createElement('div');
            hpFill.className = 'hp-fill';
            hpFill.style.width = `${(unit.hp / unit.maxHp) * 100}%`;
            hpBar.appendChild(hpFill);
            unitEl.appendChild(hpBar);

            // Attack animation
            if (unit.isAttacking) {
                unitEl.classList.add('attacking');
            }

            // Append unit directly to the cell instead of absolute positioning
            cell.appendChild(unitEl);
        });
    }

    showOverlay(text) {
        this.resultText.textContent = text;
        this.overlay.classList.remove('hidden');
    }

    hideOverlay() {
        this.overlay.classList.add('hidden');
    }
}
