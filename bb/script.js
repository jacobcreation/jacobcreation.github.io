const GRID_SIZE = 8;
const PIECE_TYPES = [
    { name: 'dot', shape: [[1]], color: 'color-1' },
    { name: 'line2', shape: [[1, 1]], color: 'color-2' },
    { name: 'line3', shape: [[1, 1, 1]], color: 'color-3' },
    { name: 'line4', shape: [[1, 1, 1, 1]], color: 'color-4' },
    { name: 'line5', shape: [[1, 1, 1, 1, 1]], color: 'color-5' },
    { name: 'vline2', shape: [[1], [1]], color: 'color-2' },
    { name: 'vline3', shape: [[1], [1], [1]], color: 'color-3' },
    { name: 'vline4', shape: [[1], [1], [1], [1]], color: 'color-4' },
    { name: 'square', shape: [[1, 1], [1, 1]], color: 'color-6' },
    { name: 'l-shape', shape: [[1, 0], [1, 0], [1, 1]], color: 'color-1' },
    { name: 'l-shape-inv', shape: [[0, 1], [0, 1], [1, 1]], color: 'color-2' },
    { name: 't-shape', shape: [[1, 1, 1], [0, 1, 0]], color: 'color-3' },
    { name: 'z-shape', shape: [[1, 1, 0], [0, 1, 1]], color: 'color-4' },
    { name: 'small-l', shape: [[1, 0], [1, 1]], color: 'color-5' }
];

// Game State
let board = Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(null));
let currentPieces = [null, null, null];
let score = 0;
let highScore = parseInt(localStorage.getItem('blockBlast_highScore')) || 0;
let isGameOver = false;
let comboCount = 0;
let powerUps = {
    hammer: 3,
    refresh: 3
};
let settings = {
    sound: localStorage.getItem('blockBlast_sound') !== 'false',
    theme: localStorage.getItem('blockBlast_theme') || 'default'
};
let isHammerActive = false;

// DOM Elements
const gridElement = document.getElementById('game-board');
const trayElement = document.getElementById('piece-tray');
const scoreElement = document.getElementById('score');
const highScoreElement = document.getElementById('high-score');
const gameOverModal = document.getElementById('game-over');
const finalScoreElement = document.getElementById('final-score');
const restartBtn = document.getElementById('restart-btn');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings');
const soundToggle = document.getElementById('sound-toggle');
const themeBtns = document.querySelectorAll('.theme-btn');
const hammerBtn = document.getElementById('powerup-hammer');
const refreshBtn = document.getElementById('powerup-refresh');
const hammerCountLabel = document.getElementById('hammer-count');
const refreshCountLabel = document.getElementById('refresh-count');
const newBestMsg = document.getElementById('new-best-msg');
const comboContainer = document.getElementById('combo-container');
const comboMultiplier = document.getElementById('combo-multiplier');

// Audio Manager
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const playSound = (type) => {
    if (!settings.sound) return;
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    const now = audioCtx.currentTime;
    
    switch(type) {
        case 'place':
            osc.type = 'sine';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
            break;
        case 'clear':
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(400 + (comboCount * 100), now);
            osc.frequency.exponentialRampToValueAtTime(800 + (comboCount * 100), now + 0.2);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
            break;
        case 'powerup':
            osc.type = 'square';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
            break;
        case 'gameover':
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.exponentialRampToValueAtTime(50, now + 0.5);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
            osc.start(now);
            osc.stop(now + 0.5);
            break;
    }
};

// Initialize
function init() {
    applyTheme(settings.theme);
    highScoreElement.textContent = highScore;
    soundToggle.checked = settings.sound;
    updatePowerUpUI();
    createGrid();
    generateNewPieces();
    updateScore(0);
    isGameOver = false;
    gameOverModal.classList.add('hidden');
    newBestMsg.classList.add('hidden');
}

function createGrid() {
    gridElement.innerHTML = '';
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.dataset.row = r;
            cell.dataset.col = c;
            cell.addEventListener('click', () => onCellClick(r, c));
            gridElement.appendChild(cell);
        }
    }
}

function generateNewPieces() {
    for (let i = 0; i < 3; i++) {
        const randomType = PIECE_TYPES[Math.floor(Math.random() * PIECE_TYPES.length)];
        currentPieces[i] = JSON.parse(JSON.stringify(randomType));
        renderPiece(i);
    }
    checkGameOver();
}

function renderPiece(index) {
    const slot = document.getElementById(`slot-${index}`);
    slot.innerHTML = '';
    if (!currentPieces[index]) return;

    const piece = currentPieces[index];
    const pieceDiv = document.createElement('div');
    pieceDiv.classList.add('piece');
    pieceDiv.dataset.index = index;
    pieceDiv.style.gridTemplateColumns = `repeat(${piece.shape[0].length}, 1fr)`;
    
    piece.shape.forEach((row, r) => {
        row.forEach((cell, c) => {
            const block = document.createElement('div');
            block.classList.add('block');
            if (cell === 1) block.classList.add(piece.color);
            else block.style.visibility = 'hidden';
            pieceDiv.appendChild(block);
        });
    });

    pieceDiv.addEventListener('pointerdown', onPointerDown);
    slot.appendChild(pieceDiv);
}

// Drag & Drop
let activePiece = null;
let activePieceData = null;
let offset = { x: 0, y: 0 };

function onPointerDown(e) {
    if (isGameOver || isHammerActive) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    activePiece = e.currentTarget;
    const index = activePiece.dataset.index;
    activePieceData = currentPieces[index];
    
    const rect = activePiece.getBoundingClientRect();
    offset.x = e.clientX - rect.left;
    offset.y = e.clientY - rect.top;
    
    activePiece.classList.add('dragging');
    updatePiecePosition(e.clientX, e.clientY);
    activePiece.style.position = 'fixed';
    
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
}

function onPointerMove(e) {
    if (!activePiece) return;
    updatePiecePosition(e.clientX, e.clientY);
    
    clearPreview();
    const gridRect = gridElement.getBoundingClientRect();
    const cellWidth = gridRect.width / GRID_SIZE;
    const cellHeight = gridRect.height / GRID_SIZE;
    
    const rect = activePiece.getBoundingClientRect();
    const col = Math.round((rect.left - gridRect.left) / cellWidth);
    const row = Math.round((rect.top - gridRect.top) / cellHeight);

    if (row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE) {
        if (canPlacePiece(activePieceData, row, col)) {
            showPreview(activePieceData, row, col);
        }
    }
}

function updatePiecePosition(x, y) {
    activePiece.style.left = `${x - offset.x}px`;
    activePiece.style.top = `${y - offset.y}px`;
}

function onPointerUp(e) {
    if (!activePiece) return;
    clearPreview();
    
    const rect = activePiece.getBoundingClientRect();
    const gridRect = gridElement.getBoundingClientRect();
    const col = Math.round((rect.left - gridRect.left) / (gridRect.width / GRID_SIZE));
    const row = Math.round((rect.top - gridRect.top) / (gridRect.height / GRID_SIZE));

    if (row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE && canPlacePiece(activePieceData, row, col)) {
        placePiece(activePieceData, row, col);
        const index = activePiece.dataset.index;
        currentPieces[index] = null;
        activePiece.remove();
        if (currentPieces.every(p => p === null)) generateNewPieces();
        else checkGameOver();
    } else {
        resetPiecePosition();
    }

    activePiece.classList.remove('dragging');
    activePiece = null;
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
}

function resetPiecePosition() {
    activePiece.style.position = 'absolute';
    activePiece.style.left = '50%';
    activePiece.style.top = '50%';
    activePiece.style.transform = 'translate(-50%, -50%)';
}

// Game Logic
function canPlacePiece(piece, startRow, startCol) {
    for (let r = 0; r < piece.shape.length; r++) {
        for (let c = 0; c < piece.shape[r].length; c++) {
            if (piece.shape[r][c] === 1) {
                const targetRow = startRow + r;
                const targetCol = startCol + c;
                if (targetRow >= GRID_SIZE || targetCol >= GRID_SIZE || board[targetRow][targetCol] !== null) return false;
            }
        }
    }
    return true;
}

function placePiece(piece, startRow, startCol) {
    let blocksPlaced = 0;
    for (let r = 0; r < piece.shape.length; r++) {
        for (let c = 0; c < piece.shape[r].length; c++) {
            if (piece.shape[r][c] === 1) {
                const tr = startRow + r, tc = startCol + c;
                board[tr][tc] = piece.color;
                const cell = document.querySelector(`.cell[data-row="${tr}"][data-col="${tc}"]`);
                cell.classList.add('filled', piece.color);
                blocksPlaced++;
            }
        }
    }
    playSound('place');
    updateScore(score + blocksPlaced);
    checkLines();
}

function checkLines() {
    let rowsToClear = [], colsToClear = [];
    for (let r = 0; r < GRID_SIZE; r++) if (board[r].every(cell => cell !== null)) rowsToClear.push(r);
    for (let c = 0; c < GRID_SIZE; c++) {
        let full = true;
        for (let r = 0; r < GRID_SIZE; r++) if (board[r][c] === null) { full = false; break; }
        if (full) colsToClear.push(c);
    }

    if (rowsToClear.length > 0 || colsToClear.length > 0) {
        comboCount++;
        updateComboUI();
        clearLines(rowsToClear, colsToClear);
    } else {
        comboCount = 0;
        updateComboUI();
    }
}

function updateComboUI() {
    if (comboCount > 1) {
        comboContainer.classList.remove('hidden');
        comboMultiplier.textContent = `x${comboCount}`;
    } else {
        comboContainer.classList.add('hidden');
    }
}

function clearLines(rows, cols) {
    let cellsToClear = new Set();
    rows.forEach(r => { for (let c = 0; c < GRID_SIZE; c++) cellsToClear.add(`${r},${c}`); });
    cols.forEach(c => { for (let r = 0; r < GRID_SIZE; r++) cellsToClear.add(`${r},${c}`); });

    const totalCleared = cellsToClear.size;
    const bonus = (rows.length + cols.length) * 10 * comboCount;
    const points = totalCleared + bonus;
    
    updateScore(score + points);
    showFloatingScore(points);
    playSound('clear');
    if (comboCount > 1) gridElement.classList.add('shake');
    setTimeout(() => gridElement.classList.remove('shake'), 400);

    cellsToClear.forEach(pos => {
        const [r, c] = pos.split(',').map(Number);
        board[r][c] = null;
        const cell = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
        cell.classList.add('clearing');
        setTimeout(() => {
            cell.classList.remove('clearing', 'filled');
            PIECE_TYPES.forEach(t => cell.classList.remove(t.color));
        }, 300);
    });
}

// Power-ups
function useHammer() {
    if (powerUps.hammer <= 0 || isGameOver) return;
    isHammerActive = !isHammerActive;
    hammerBtn.classList.toggle('active', isHammerActive);
}

function onCellClick(r, c) {
    if (isHammerActive && board[r][c] !== null) {
        board[r][c] = null;
        const cell = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
        cell.classList.add('clearing');
        setTimeout(() => cell.classList.remove('clearing', 'filled'), 300);
        PIECE_TYPES.forEach(t => cell.classList.remove(t.color));
        
        powerUps.hammer--;
        isHammerActive = false;
        hammerBtn.classList.remove('active');
        updatePowerUpUI();
        playSound('powerup');
        checkGameOver();
    }
}

function refreshPieces() {
    if (powerUps.refresh <= 0 || isGameOver) return;
    powerUps.refresh--;
    updatePowerUpUI();
    playSound('powerup');
    generateNewPieces();
}

function updatePowerUpUI() {
    hammerCountLabel.textContent = powerUps.hammer;
    refreshCountLabel.textContent = powerUps.refresh;
    hammerBtn.disabled = powerUps.hammer <= 0;
    refreshBtn.disabled = powerUps.refresh <= 0;
}

// UI Helpers
function showPreview(piece, startRow, startCol) {
    for (let r = 0; r < piece.shape.length; r++) {
        for (let c = 0; c < piece.shape[r].length; c++) {
            if (piece.shape[r][c] === 1) {
                const cell = document.querySelector(`.cell[data-row="${startRow + r}"][data-col="${startCol + c}"]`);
                if (cell) cell.classList.add('preview');
            }
        }
    }
}

function clearPreview() {
    document.querySelectorAll('.cell.preview').forEach(c => c.classList.remove('preview'));
}

function updateScore(n) {
    score = n;
    scoreElement.textContent = score;
    if (score > highScore) {
        highScore = score;
        highScoreElement.textContent = highScore;
        localStorage.setItem('blockBlast_highScore', highScore);
    }
}

function showFloatingScore(pts) {
    const el = document.createElement('div');
    el.className = 'floating-score';
    el.textContent = `+${pts}`;
    el.style.left = '50%'; el.style.top = '40%';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 800);
}

function applyTheme(t) {
    document.body.setAttribute('data-theme', t);
    themeBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.theme === t));
    localStorage.setItem('blockBlast_theme', t);
}

function checkGameOver() {
    const remaining = currentPieces.filter(p => p !== null);
    if (remaining.length === 0) return;
    let canMove = false;
    for (const p of remaining) {
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) if (canPlacePiece(p, r, c)) { canMove = true; break; }
            if (canMove) break;
        }
        if (canMove) break;
    }
    if (!canMove) endGame();
}

function endGame() {
    isGameOver = true;
    finalScoreElement.textContent = score;
    if (score === highScore && score > 0) {
        newBestMsg.classList.remove('hidden');
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    }
    gameOverModal.classList.remove('hidden');
    playSound('gameover');
}

// Event Listeners
restartBtn.addEventListener('click', () => {
    board = Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(null));
    score = 0; comboCount = 0;
    powerUps = { hammer: 3, refresh: 3 };
    init();
});

settingsBtn.addEventListener('click', () => settingsModal.classList.remove('hidden'));
closeSettingsBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));
soundToggle.addEventListener('change', (e) => {
    settings.sound = e.target.checked;
    localStorage.setItem('blockBlast_sound', settings.sound);
});
themeBtns.forEach(btn => btn.addEventListener('click', () => applyTheme(btn.dataset.theme)));
hammerBtn.addEventListener('click', useHammer);
refreshBtn.addEventListener('click', refreshPieces);

init();
