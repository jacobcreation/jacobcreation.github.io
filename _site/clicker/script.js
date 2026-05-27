// Game State
let state = {
    energy: 0,
    clickPower: 1,
    perSecond: 0,
    lastUpdate: Date.now()
};

// Upgrade Definitions
const UPGRADES = [
    {
        id: 'clicker',
        name: 'Enhanced Pulse',
        description: 'Increases click power by 1',
        baseCost: 15,
        type: 'click',
        benefit: 1,
        owned: 0
    },
    {
        id: 'drone',
        name: 'Energy Drone',
        description: 'Generates 1 energy per second',
        baseCost: 100,
        type: 'auto',
        benefit: 1,
        owned: 0
    },
    {
        id: 'station',
        name: 'Neon Station',
        description: 'Generates 5 energy per second',
        baseCost: 500,
        type: 'auto',
        benefit: 5,
        owned: 0
    },
    {
        id: 'reactor',
        name: 'Quantum Reactor',
        description: 'Generates 20 energy per second',
        baseCost: 2500,
        type: 'auto',
        benefit: 20,
        owned: 0
    }
];

// DOM Elements
const energyDisplay = document.getElementById('energy-count');
const psDisplay = document.getElementById('energy-per-second');
const mainOrb = document.getElementById('main-orb');
const upgradesList = document.getElementById('upgrades-list');

// Initialization
function init() {
    loadGame();
    renderUpgrades();
    setupEventListeners();
    gameLoop();
}

function setupEventListeners() {
    mainOrb.addEventListener('click', (e) => {
        state.energy += state.clickPower;
        createFloatingText(e.clientX, e.clientY, `+${state.clickPower}`);
        updateUI();
    });
}

function createFloatingText(x, y, text) {
    const el = document.createElement('div');
    el.className = 'floating-text';
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    document.body.appendChild(el);

    setTimeout(() => el.remove(), 800);
}

function calculateCost(upgrade) {
    return Math.floor(upgrade.baseCost * Math.pow(1.15, upgrade.owned));
}

function renderUpgrades() {
    upgradesList.innerHTML = '';
    UPGRADES.forEach(upgrade => {
        const cost = calculateCost(upgrade);
        const item = document.createElement('div');
        item.className = `upgrade-item ${state.energy < cost ? 'disabled' : ''}`;
        item.innerHTML = `
            <span class="upgrade-name">${upgrade.name}</span>
            <div class="upgrade-info">
                <span>Owned: ${upgrade.owned}</span>
                <span class="cost">${cost} Energy</span>
            </div>
        `;
        item.onclick = () => buyUpgrade(upgrade);
        upgradesList.appendChild(item);
    });
}

function buyUpgrade(upgrade) {
    const cost = calculateCost(upgrade);
    if (state.energy >= cost) {
        state.energy -= cost;
        upgrade.owned++;
        
        if (upgrade.type === 'click') {
            state.clickPower += upgrade.benefit;
        } else {
            state.perSecond += upgrade.benefit;
        }
        
        saveGame();
        renderUpgrades();
        updateUI();
    }
}

function updateUI() {
    energyDisplay.textContent = Math.floor(state.energy).toLocaleString();
    psDisplay.textContent = state.perSecond.toLocaleString();
    
    // Update upgrade buttons state (disabled/enabled)
    const items = upgradesList.querySelectorAll('.upgrade-item');
    UPGRADES.forEach((upgrade, index) => {
        const cost = calculateCost(upgrade);
        if (state.energy < cost) {
            items[index].classList.add('disabled');
        } else {
            items[index].classList.remove('disabled');
        }
    });
}

function gameLoop() {
    const now = Date.now();
    const deltaTime = (now - state.lastUpdate) / 1000;
    state.lastUpdate = now;

    if (state.perSecond > 0) {
        state.energy += state.perSecond * deltaTime;
        updateUI();
    }

    requestAnimationFrame(gameLoop);
}

// Persistence
function saveGame() {
    const saveData = {
        state: state,
        upgrades: UPGRADES.map(u => ({ id: u.id, owned: u.owned }))
    };
    localStorage.setItem('neonOrbitSave', JSON.stringify(saveData));
}

function loadGame() {
    const saved = localStorage.getItem('neonOrbitSave');
    if (saved) {
        const data = JSON.parse(saved);
        state = { ...state, ...data.state };
        state.lastUpdate = Date.now(); // Reset last update to now to prevent massive jump
        
        data.upgrades.forEach(savedUpgrade => {
            const upgrade = UPGRADES.find(u => u.id === savedUpgrade.id);
            if (upgrade) {
                upgrade.owned = savedUpgrade.owned;
            }
        });
    }
}

// Auto-save every 30 seconds
setInterval(saveGame, 30000);

init();
