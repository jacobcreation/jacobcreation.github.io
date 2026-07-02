// Game State
let state = {
    energy: 0,
    clickPower: 1,
    perSecond: 0,
    lastUpdate: Date.now()
};
let lastCloudSave = 0;

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
    window.addEventListener('jacob-account-change', loadCloudSave);
    setTimeout(loadCloudSave, 700);
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
    localStorage.setItem('neonOrbitSave', JSON.stringify(createSaveData()));
    saveCloudGame();
}

function loadGame() {
    const saved = localStorage.getItem('neonOrbitSave');
    if (saved) {
        const data = JSON.parse(saved);
        applySaveData(data);
    }
}

function createSaveData() {
    return {
        state: { ...state, lastUpdate: Date.now() },
        upgrades: UPGRADES.map(u => ({ id: u.id, owned: u.owned })),
        updatedAt: Date.now()
    };
}

function applySaveData(data) {
    if (!data || typeof data !== 'object') return;
    state = { ...state, ...(data.state || {}) };
    state.lastUpdate = Date.now();

    if (Array.isArray(data.upgrades)) {
        data.upgrades.forEach(savedUpgrade => {
            const upgrade = UPGRADES.find(u => u.id === savedUpgrade.id);
            if (upgrade) {
                upgrade.owned = Number(savedUpgrade.owned) || 0;
            }
        });
    }
    renderUpgrades();
    updateUI();
}

async function loadCloudSave() {
    const accounts = window.JacobAccounts;
    if (!accounts || !accounts.isSignedIn || !accounts.isSignedIn()) return;

    try {
        const record = await accounts.getData('clicker', 'save');
        const remote = record && record.value;
        const local = JSON.parse(localStorage.getItem('neonOrbitSave') || 'null');
        if (remote && (!local || Number(remote.updatedAt || 0) > Number(local.updatedAt || 0))) {
            applySaveData(remote);
            localStorage.setItem('neonOrbitSave', JSON.stringify(remote));
        }
    } catch (error) {
        if (!/not found/i.test(error.message || '')) console.warn('Could not load cloud clicker save', error);
    }
}

function saveCloudGame(force = false) {
    const accounts = window.JacobAccounts;
    if (!accounts || !accounts.isSignedIn || !accounts.isSignedIn()) return;
    const now = Date.now();
    if (!force && now - lastCloudSave < 15000) return;
    lastCloudSave = now;

    accounts.setData('clicker', 'save', createSaveData(), {
        label: 'Neon Orbit save',
        meta: { energy: Math.floor(state.energy), perSecond: state.perSecond }
    }).catch(() => {});
}

// Auto-save every 30 seconds
setInterval(() => {
    saveGame();
    saveCloudGame(true);
}, 30000);

init();
