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

let board = Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(null));
let currentPieces = [null, null, null];
let score = 0;
let isGameOver = false;

const gridElement = document.getElementById('game-board');
const trayElement = document.getElementById('piece-tray');
const scoreElement = document.getElementById('score');
const gameOverModal = document.getElementById('game-over');
const finalScoreElement = document.getElementById('final-score');
const restartBtn = document.getElementById('restart-btn');

// Initialize the game
function init() {
    createGrid();
    generateNewPieces();
    updateScore(0);
    isGameOver = false;
    gameOverModal.classList.add('hidden');
}

function createGrid() {
    gridElement.innerHTML = '';
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.dataset.row = r;
            cell.dataset.col = c;
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
            if (cell === 1) {
                block.classList.add(piece.color);
            } else {
                block.style.visibility = 'hidden';
            }
            pieceDiv.appendChild(block);
        });
    });

    pieceDiv.addEventListener('pointerdown', onPointerDown);
    slot.appendChild(pieceDiv);
}

let activePiece = null;
let activePieceData = null;
let offset = { x: 0, y: 0 };
let originalSlot = null;

function onPointerDown(e) {
    if (isGameOver) return;
    
    activePiece = e.currentTarget;
    const index = activePiece.dataset.index;
    activePieceData = currentPieces[index];
    
    const rect = activePiece.getBoundingClientRect();
    offset.x = e.clientX - rect.left;
    offset.y = e.clientY - rect.top;
    
    activePiece.classList.add('dragging');
    activePiece.style.left = `${e.clientX - offset.x}px`;
    activePiece.style.top = `${e.clientY - offset.y}px`;
    activePiece.style.position = 'fixed';
    
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
}

function onPointerMove(e) {
    if (!activePiece) return;
    activePiece.style.left = `${e.clientX - offset.x}px`;
    activePiece.style.top = `${e.clientY - offset.y}px`;

    // Preview logic
    clearPreview();
    const rect = activePiece.getBoundingClientRect();
    const gridRect = gridElement.getBoundingClientRect();
    const cellWidth = gridRect.width / GRID_SIZE;
    const cellHeight = gridRect.height / GRID_SIZE;
    const col = Math.round((rect.left - gridRect.left) / cellWidth);
    const row = Math.round((rect.top - gridRect.top) / cellHeight);

    if (row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE) {
        if (canPlacePiece(activePieceData, row, col)) {
            showPreview(activePieceData, row, col);
        }
    }
}

function clearPreview() {
    document.querySelectorAll('.cell.preview').forEach(cell => {
        cell.classList.remove('preview');
        PIECE_TYPES.forEach(t => cell.classList.remove(`${t.color}-preview`));
    });
}

function showPreview(piece, startRow, startCol) {
    for (let r = 0; r < piece.shape.length; r++) {
        for (let c = 0; c < piece.shape[r].length; c++) {
            if (piece.shape[r][c] === 1) {
                const targetRow = startRow + r;
                const targetCol = startCol + c;
                if (targetRow < GRID_SIZE && targetCol < GRID_SIZE) {
                    const cell = document.querySelector(`.cell[data-row="${targetRow}"][data-col="${targetCol}"]`);
                    if (cell) {
                        cell.classList.add('preview', `${piece.color}-preview`);
                    }
                }
            }
        }
    }
}

function onPointerUp(e) {
    if (!activePiece) return;
    clearPreview();
...
    const rect = activePiece.getBoundingClientRect();
    const gridRect = gridElement.getBoundingClientRect();
    
    // Calculate the cell width and height
    const cellWidth = gridRect.width / GRID_SIZE;
    const cellHeight = gridRect.height / GRID_SIZE;
    
    // Calculate which cell the top-left of the piece is over
    // We adjust by half a cell to make it feel more natural (snapping)
    const relativeX = rect.left - gridRect.left;
    const relativeY = rect.top - gridRect.top;
    
    const col = Math.round(relativeX / cellWidth);
    const row = Math.round(relativeY / cellHeight);

    if (row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE) {
        if (canPlacePiece(activePieceData, row, col)) {
            placePiece(activePieceData, row, col);
            const index = activePiece.dataset.index;
            currentPieces[index] = null;
            activePiece.remove();
            
            if (currentPieces.every(p => p === null)) {
                generateNewPieces();
            } else {
                checkGameOver();
            }
        } else {
            resetPiecePosition();
        }
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

function canPlacePiece(piece, startRow, startCol) {
    for (let r = 0; r < piece.shape.length; r++) {
        for (let c = 0; c < piece.shape[r].length; c++) {
            if (piece.shape[r][c] === 1) {
                const targetRow = startRow + r;
                const targetCol = startCol + c;
                
                if (targetRow >= GRID_SIZE || targetCol >= GRID_SIZE || 
                    board[targetRow][targetCol] !== null) {
                    return false;
                }
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
                const targetRow = startRow + r;
                const targetCol = startCol + c;
                board[targetRow][targetCol] = piece.color;
                
                const cell = document.querySelector(`.cell[data-row="${targetRow}"][data-col="${targetCol}"]`);
                cell.classList.add('filled', piece.color);
                blocksPlaced++;
            }
        }
    }
    
    updateScore(score + blocksPlaced);
    checkLines();
}

function checkLines() {
    let rowsToClear = [];
    let colsToClear = [];

    // Check rows
    for (let r = 0; r < GRID_SIZE; r++) {
        if (board[r].every(cell => cell !== null)) {
            rowsToClear.push(r);
        }
    }

    // Check columns
    for (let c = 0; c < GRID_SIZE; c++) {
        let full = true;
        for (let r = 0; r < GRID_SIZE; r++) {
            if (board[r][c] === null) {
                full = false;
                break;
            }
        }
        if (full) {
            colsToClear.push(c);
        }
    }

    if (rowsToClear.length > 0 || colsToClear.length > 0) {
        clearLines(rowsToClear, colsToClear);
    }
}

function clearLines(rows, cols) {
    let cellsToClear = new Set();
    
    rows.forEach(r => {
        for (let c = 0; c < GRID_SIZE; c++) {
            cellsToClear.add(`${r},${c}`);
        }
    });
    
    cols.forEach(c => {
        for (let r = 0; r < GRID_SIZE; r++) {
            cellsToClear.add(`${r},${c}`);
        }
    });

    const clearedCount = cellsToClear.size;
    
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

    // Scoring bonus for multiple lines
    const combo = rows.length + cols.length;
    const points = clearedCount * combo;
    updateScore(score + points);
}

function updateScore(newScore) {
    score = newScore;
    scoreElement.textContent = score;
}

function checkGameOver() {
    const remainingPieces = currentPieces.filter(p => p !== null);
    if (remainingPieces.length === 0) return;

    let canMove = false;
    for (const piece of remainingPieces) {
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                if (canPlacePiece(piece, r, c)) {
                    canMove = true;
                    break;
                }
            }
            if (canMove) break;
        }
        if (canMove) break;
    }

    if (!canMove) {
        endGame();
    }
}

function endGame() {
    isGameOver = true;
    finalScoreElement.textContent = score;
    gameOverModal.classList.remove('hidden');
}

restartBtn.addEventListener('click', () => {
    board = Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(null));
    score = 0;
    init();
});

init();
