const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startPauseBtn = document.getElementById('startPauseBtn');
const randomizeBtn = document.getElementById('randomizeBtn');
const clearBtn = document.getElementById('clearBtn');
const speedRange = document.getElementById('speedRange');
const generationCountEl = document.getElementById('generationCount');

const CELL_SIZE = 10;
let COLS, ROWS;
let grid;
let nextGrid;
let isPlaying = false;
let generation = 0;
let lastTime = 0;

function init() {
    resizeCanvas();
    grid = createGrid();
    nextGrid = createGrid();
    randomize();
    draw();
}

function resizeCanvas() {
    const width = Math.min(window.innerWidth * 0.9, 800);
    const height = Math.min(window.innerHeight * 0.6, 600);
    
    canvas.width = Math.floor(width / CELL_SIZE) * CELL_SIZE;
    canvas.height = Math.floor(height / CELL_SIZE) * CELL_SIZE;
    
    COLS = canvas.width / CELL_SIZE;
    ROWS = canvas.height / CELL_SIZE;
}

function createGrid() {
    return Array.from({ length: COLS }, () => new Uint8Array(ROWS));
}

function randomize() {
    for (let i = 0; i < COLS; i++) {
        for (let j = 0; j < ROWS; j++) {
            grid[i][j] = Math.random() > 0.8 ? 1 : 0;
        }
    }
    generation = 0;
    updateStats();
    draw();
}

function clear() {
    for (let i = 0; i < COLS; i++) {
        for (let j = 0; j < ROWS; j++) {
            grid[i][j] = 0;
        }
    }
    generation = 0;
    updateStats();
    draw();
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw grid lines
    ctx.strokeStyle = '#eee';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= COLS; i++) {
        ctx.beginPath();
        ctx.moveTo(i * CELL_SIZE, 0);
        ctx.lineTo(i * CELL_SIZE, canvas.height);
        ctx.stroke();
    }
    for (let j = 0; j <= ROWS; j++) {
        ctx.beginPath();
        ctx.moveTo(0, j * CELL_SIZE);
        ctx.lineTo(canvas.width, j * CELL_SIZE);
        ctx.stroke();
    }

    // Draw cells
    ctx.fillStyle = '#000';
    for (let i = 0; i < COLS; i++) {
        for (let j = 0; j < ROWS; j++) {
            if (grid[i][j]) {
                ctx.fillRect(i * CELL_SIZE + 1, j * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
            }
        }
    }
}

function update() {
    for (let i = 0; i < COLS; i++) {
        for (let j = 0; j < ROWS; j++) {
            const neighbors = countNeighbors(i, j);
            const state = grid[i][j];

            if (state === 1 && (neighbors < 2 || neighbors > 3)) {
                nextGrid[i][j] = 0;
            } else if (state === 0 && neighbors === 3) {
                nextGrid[i][j] = 1;
            } else {
                nextGrid[i][j] = state;
            }
        }
    }

    // Swap grids
    [grid, nextGrid] = [nextGrid, grid];
    generation++;
    updateStats();
}

function countNeighbors(x, y) {
    let sum = 0;
    for (let i = -1; i < 2; i++) {
        for (let j = -1; j < 2; j++) {
            if (i === 0 && j === 0) continue;
            
            const col = (x + i + COLS) % COLS;
            const row = (y + j + ROWS) % ROWS;
            sum += grid[col][row];
        }
    }
    return sum;
}

function updateStats() {
    generationCountEl.textContent = generation;
}

function gameLoop(time) {
    if (!isPlaying) return;

    const fps = parseInt(speedRange.value);
    const interval = 1000 / fps;
    const delta = time - lastTime;

    if (delta > interval) {
        update();
        draw();
        lastTime = time - (delta % interval);
    }

    requestAnimationFrame(gameLoop);
}

// Interactivity
let isDrawing = false;

function handleInteraction(e) {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / CELL_SIZE);
    const y = Math.floor((e.clientY - rect.top) / CELL_SIZE);

    if (x >= 0 && x < COLS && y >= 0 && y < ROWS) {
        grid[x][y] = 1;
        draw();
    }
}

canvas.addEventListener('mousedown', (e) => {
    isDrawing = true;
    handleInteraction(e);
});

window.addEventListener('mousemove', (e) => {
    if (isDrawing) handleInteraction(e);
});

window.addEventListener('mouseup', () => {
    isDrawing = false;
});

startPauseBtn.addEventListener('click', () => {
    isPlaying = !isPlaying;
    startPauseBtn.textContent = isPlaying ? 'Pause' : 'Start';
    if (isPlaying) {
        lastTime = performance.now();
        requestAnimationFrame(gameLoop);
    }
});

randomizeBtn.addEventListener('click', randomize);
clearBtn.addEventListener('click', () => {
    if (isPlaying) {
        isPlaying = false;
        startPauseBtn.textContent = 'Start';
    }
    clear();
});

window.addEventListener('resize', () => {
    const oldGrid = grid;
    resizeCanvas();
    grid = createGrid();
    nextGrid = createGrid();
    
    // Copy old grid to new grid
    const colsToCopy = Math.min(oldGrid.length, COLS);
    const rowsToCopy = Math.min(oldGrid[0].length, ROWS);
    for (let i = 0; i < colsToCopy; i++) {
        for (let j = 0; j < rowsToCopy; j++) {
            grid[i][j] = oldGrid[i][j];
        }
    }
    draw();
});

init();
