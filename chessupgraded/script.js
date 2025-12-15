const board = document.getElementById("board");
const game = new Chess();
const statusEl = document.getElementById("status");
let botType = "easy";
let stockfish = null;

/* ---------- UI ---------- */

document.getElementById("botSelect").addEventListener("change", e => {
  botType = e.target.value;
});

document.getElementById("resetBtn").addEventListener("click", () => {
  game.reset();
  board.position = "start";
  statusEl.textContent = "Your move (White)";
});

/* ---------- BOARD EVENTS ---------- */

board.addEventListener("drag-start", e => {
  const piece = e.detail.piece;
  if (game.game_over()) e.preventDefault();
  if (piece.startsWith("b")) e.preventDefault();
});

board.addEventListener("drop", e => {
  const { source, target } = e.detail;

  const move = game.move({
    from: source,
    to: target,
    promotion: "q"
  });

  if (!move) {
    e.preventDefault();
    return;
  }

  board.position = game.fen();
  updateStatus();

  setTimeout(makeBotMove, 300);
});

/* ---------- BOT LOGIC ---------- */

function makeBotMove() {
  if (game.game_over()) return;

  if (botType === "stockfish") {
    stockfishMove();
    return;
  }

  const moves = game.moves({ verbose: true });
  let move;

  if (botType === "easy") move = randomMove(moves);
  if (botType === "aggressive") move = aggressiveMove(moves);
  if (botType === "defensive") move = defensiveMove(moves);
  if (botType === "strong") move = minimaxRoot(2);

  game.move(move);
  board.position = game.fen();
  updateStatus();
}

function randomMove(moves) {
  return moves[Math.floor(Math.random() * moves.length)];
}

function aggressiveMove(moves) {
  const captures = moves.filter(m => m.captured);
  return captures.length ? randomMove(captures) : randomMove(moves);
}

function defensiveMove(moves) {
  const quiet = moves.filter(m => !m.captured);
  return quiet.length ? randomMove(quiet) : randomMove(moves);
}

/* ---------- MINIMAX (Strong Bot) ---------- */

function minimaxRoot(depth) {
  let bestMove = null;
  let bestValue = -9999;

  for (const move of game.moves({ verbose: true })) {
    game.move(move);
    const value = minimax(depth - 1, false);
    game.undo();

    if (value > bestValue) {
      bestValue = value;
      bestMove = move;
    }
  }
  return bestMove;
}

function minimax(depth, isMax) {
  if (depth === 0) return evaluate();

  let best = isMax ? -9999 : 9999;

  for (const move of game.moves({ verbose: true })) {
    game.move(move);
    best = isMax
      ? Math.max(best, minimax(depth - 1, false))
      : Math.min(best, minimax(depth - 1, true));
    game.undo();
  }
  return best;
}

function evaluate() {
  const values = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  return game.board().flat().reduce((sum, p) => {
    if (!p) return sum;
    return sum + (p.color === "w" ? values[p.type] : -values[p.type]);
  }, 0);
}

/* ---------- STOCKFISH ---------- */

function stockfishMove() {
  if (!stockfish) stockfish = Stockfish();

  stockfish.postMessage("uci");
  stockfish.postMessage("position fen " + game.fen());
  stockfish.postMessage("go depth 15");

  stockfish.onmessage = e => {
    if (e.data.startsWith("bestmove")) {
      const move = e.data.split(" ")[1];
      game.move({
        from: move.slice(0, 2),
        to: move.slice(2, 4),
        promotion: "q"
      });
      board.position = game.fen();
      updateStatus();
    }
  };
}

/* ---------- STATUS ---------- */

function updateStatus() {
  if (game.in_checkmate()) statusEl.textContent = "Checkmate!";
  else if (game.in_draw()) statusEl.textContent = "Draw!";
  else statusEl.textContent = game.turn() === "w"
    ? "Your move"
    : "Bot thinking...";
}

updateStatus();
