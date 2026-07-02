const COLS = 10;
const ROWS = 20;
const BLOCK = 30;
const PREVIEW_BLOCK = 24;
const LEVEL_STEP = 10;
const BASE_DROP_INTERVAL = 700;
const MIN_DROP_INTERVAL = 120;

const PIECES = {
  I: {
    color: "#54d2ff",
    shape: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ]
  },
  J: {
    color: "#457bff",
    shape: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0]
    ]
  },
  L: {
    color: "#ff9f1c",
    shape: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0]
    ]
  },
  O: {
    color: "#ffd60a",
    shape: [
      [1, 1],
      [1, 1]
    ]
  },
  S: {
    color: "#80ed99",
    shape: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0]
    ]
  },
  T: {
    color: "#c77dff",
    shape: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0]
    ]
  },
  Z: {
    color: "#ff5d73",
    shape: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0]
    ]
  }
};

const SCORE_BY_LINES = {
  1: 100,
  2: 300,
  3: 500,
  4: 800
};

const canvas = document.getElementById("game");
const context = canvas.getContext("2d");
const previewCanvas = document.getElementById("next");
const previewContext = previewCanvas.getContext("2d");

const scoreValue = document.getElementById("score");
const levelValue = document.getElementById("level");
const linesValue = document.getElementById("lines");
const startButton = document.getElementById("start-button");
const pauseButton = document.getElementById("pause-button");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayMessage = document.getElementById("overlay-message");

let board = [];
let currentPiece = null;
let nextPiece = null;
let score = 0;
let level = 1;
let lines = 0;
let dropAccumulator = 0;
let lastFrameTime = 0;
let animationFrameId = 0;
let isPaused = false;
let isGameOver = false;
let bestScore = Number(localStorage.getItem("tetris_best_score") || 0);

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function cloneMatrix(matrix) {
  return matrix.map((row) => [...row]);
}

function randomPiece() {
  const types = Object.keys(PIECES);
  const type = types[Math.floor(Math.random() * types.length)];
  const definition = PIECES[type];
  return {
    type,
    color: definition.color,
    matrix: cloneMatrix(definition.shape),
    x: 0,
    y: 0
  };
}

function spawnPiece() {
  currentPiece = nextPiece || randomPiece();
  nextPiece = randomPiece();
  currentPiece.x = Math.floor((COLS - currentPiece.matrix[0].length) / 2);
  currentPiece.y = 0;

  if (collides(currentPiece, board)) {
    setGameOver();
  }
}

function rotateMatrix(matrix) {
  return matrix[0].map((_, index) => matrix.map((row) => row[index]).reverse());
}

function collides(piece, targetBoard) {
  for (let y = 0; y < piece.matrix.length; y += 1) {
    for (let x = 0; x < piece.matrix[y].length; x += 1) {
      if (!piece.matrix[y][x]) {
        continue;
      }

      const boardX = piece.x + x;
      const boardY = piece.y + y;

      if (boardX < 0 || boardX >= COLS || boardY >= ROWS) {
        return true;
      }

      if (boardY >= 0 && targetBoard[boardY][boardX]) {
        return true;
      }
    }
  }

  return false;
}

function mergePiece() {
  currentPiece.matrix.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (!cell) {
        return;
      }

      const boardY = currentPiece.y + y;
      if (boardY >= 0) {
        board[boardY][currentPiece.x + x] = currentPiece.color;
      }
    });
  });
}

function clearLines() {
  let cleared = 0;

  for (let y = ROWS - 1; y >= 0; y -= 1) {
    if (board[y].every(Boolean)) {
      board.splice(y, 1);
      board.unshift(Array(COLS).fill(null));
      cleared += 1;
      y += 1;
    }
  }

  if (!cleared) {
    return;
  }

  lines += cleared;
  score += (SCORE_BY_LINES[cleared] || 0) * level;
  level = Math.floor(lines / LEVEL_STEP) + 1;
  syncHud();
}

function dropPiece() {
  if (isPaused || isGameOver) {
    return;
  }

  currentPiece.y += 1;
  if (collides(currentPiece, board)) {
    currentPiece.y -= 1;
    mergePiece();
    clearLines();
    spawnPiece();
  }

  dropAccumulator = 0;
}

function hardDrop() {
  if (isPaused || isGameOver) {
    return;
  }

  while (!collides(currentPiece, board)) {
    currentPiece.y += 1;
  }

  currentPiece.y -= 1;
  mergePiece();
  clearLines();
  spawnPiece();
  dropAccumulator = 0;
}

function movePiece(direction) {
  if (isPaused || isGameOver) {
    return;
  }

  currentPiece.x += direction;
  if (collides(currentPiece, board)) {
    currentPiece.x -= direction;
  }
}

function rotatePiece() {
  if (isPaused || isGameOver) {
    return;
  }

  const originalMatrix = currentPiece.matrix;
  const rotated = rotateMatrix(originalMatrix);
  const originalX = currentPiece.x;
  const offsets = [0, -1, 1, -2, 2];

  currentPiece.matrix = rotated;

  for (const offset of offsets) {
    currentPiece.x = originalX + offset;
    if (!collides(currentPiece, board)) {
      return;
    }
  }

  currentPiece.matrix = originalMatrix;
  currentPiece.x = originalX;
}

function drawBlock(targetContext, x, y, size, color) {
  targetContext.fillStyle = color;
  targetContext.fillRect(x * size, y * size, size, size);
  targetContext.fillStyle = "rgba(255, 255, 255, 0.18)";
  targetContext.fillRect(x * size + 3, y * size + 3, size - 6, size - 6);
  targetContext.strokeStyle = "rgba(9, 19, 29, 0.45)";
  targetContext.lineWidth = 2;
  targetContext.strokeRect(x * size + 1, y * size + 1, size - 2, size - 2);
}

function drawBoard() {
  context.clearRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = "#09131d";
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      if (board[y][x]) {
        drawBlock(context, x, y, BLOCK, board[y][x]);
      } else {
        context.strokeStyle = "rgba(255, 255, 255, 0.05)";
        context.strokeRect(x * BLOCK, y * BLOCK, BLOCK, BLOCK);
      }
    }
  }

  if (!currentPiece) {
    return;
  }

  currentPiece.matrix.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell) {
        drawBlock(context, currentPiece.x + x, currentPiece.y + y, BLOCK, currentPiece.color);
      }
    });
  });
}

function drawPreview() {
  previewContext.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  previewContext.fillStyle = "#09131d";
  previewContext.fillRect(0, 0, previewCanvas.width, previewCanvas.height);

  if (!nextPiece) {
    return;
  }

  const matrix = nextPiece.matrix;
  const offsetX = Math.floor((previewCanvas.width - matrix[0].length * PREVIEW_BLOCK) / 2 / PREVIEW_BLOCK);
  const offsetY = Math.floor((previewCanvas.height - matrix.length * PREVIEW_BLOCK) / 2 / PREVIEW_BLOCK);

  matrix.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell) {
        drawBlock(previewContext, offsetX + x, offsetY + y, PREVIEW_BLOCK, nextPiece.color);
      }
    });
  });
}

function syncHud() {
  scoreValue.textContent = String(score);
  levelValue.textContent = String(level);
  linesValue.textContent = String(lines);
}

function showOverlay(title, message) {
  overlayTitle.textContent = title;
  overlayMessage.textContent = message;
  overlay.classList.remove("hidden");
}

function hideOverlay() {
  overlay.classList.add("hidden");
}

function setPaused(nextPaused) {
  if (isGameOver) {
    return;
  }

  isPaused = nextPaused;
  pauseButton.textContent = isPaused ? "Resume" : "Pause";

  if (isPaused) {
    showOverlay("Paused", "Press P or Resume to keep stacking.");
  } else {
    hideOverlay();
    lastFrameTime = performance.now();
  }
}

function setGameOver() {
  isGameOver = true;
  saveRunResult();
  showOverlay("Game Over", "Press New Game to start another run.");
}

function getDropInterval() {
  return Math.max(MIN_DROP_INTERVAL, BASE_DROP_INTERVAL - (level - 1) * 55);
}

function resetGame() {
  board = createBoard();
  score = 0;
  level = 1;
  lines = 0;
  dropAccumulator = 0;
  isPaused = false;
  isGameOver = false;
  nextPiece = randomPiece();
  pauseButton.textContent = "Pause";
  hideOverlay();
  syncHud();
  spawnPiece();
  drawBoard();
  drawPreview();
  lastFrameTime = performance.now();
}

function saveRunResult() {
  if (score <= 0) {
    return;
  }

  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem("tetris_best_score", String(bestScore));
  }

  const accounts = window.JacobAccounts;
  if (!accounts || !accounts.isSignedIn || !accounts.isSignedIn()) {
    return;
  }

  accounts.saveHighScore("tetris", score, {
    gameName: "Tetris",
    label: `Level ${level}`,
    mode: "classic",
    meta: { lines, level },
  }).catch(() => {});

  accounts.setProgress("tetris", {
    bestScore,
    lastScore: score,
    lines,
    level,
  }).catch(() => {});
}

function update(frameTime = 0) {
  animationFrameId = window.requestAnimationFrame(update);

  if (isPaused || isGameOver) {
    drawBoard();
    drawPreview();
    return;
  }

  const delta = frameTime - lastFrameTime;
  lastFrameTime = frameTime;
  dropAccumulator += delta;

  if (dropAccumulator >= getDropInterval()) {
    dropPiece();
  }

  drawBoard();
  drawPreview();
}

document.addEventListener("keydown", (event) => {
  if (event.code === "KeyP") {
    setPaused(!isPaused);
    return;
  }

  if (event.code === "Space") {
    event.preventDefault();
    hardDrop();
    return;
  }

  switch (event.key) {
    case "ArrowLeft":
      event.preventDefault();
      movePiece(-1);
      break;
    case "ArrowRight":
      event.preventDefault();
      movePiece(1);
      break;
    case "ArrowDown":
      event.preventDefault();
      dropPiece();
      break;
    case "ArrowUp":
      event.preventDefault();
      rotatePiece();
      break;
    default:
      break;
  }
});

startButton.addEventListener("click", resetGame);

// Mobile touch controls
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.mobile-controls button');
  if (!btn) return;
  const action = btn.dataset.action;
  switch (action) {
    case 'move-left':
      movePiece(-1);
      break;
    case 'move-right':
      movePiece(1);
      break;
    case 'soft-drop':
      dropPiece();
      break;
    case 'rotate':
      rotatePiece();
      break;
    case 'hard-drop':
      hardDrop();
      break;
  }
});
pauseButton.addEventListener("click", () => setPaused(!isPaused));

resetGame();
cancelAnimationFrame(animationFrameId);
animationFrameId = window.requestAnimationFrame(update);
