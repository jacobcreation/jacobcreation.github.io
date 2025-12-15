let board;
let game = new Chess();
let botType = "easy";
let stockfish = null;

const statusEl = document.getElementById("status");

document.getElementById("botSelect").addEventListener("change", e => {
  botType = e.target.value;
});

document.getElementById("resetBtn").addEventListener("click", resetGame);

function resetGame() {
  game.reset();
  board.position(game.fen());
  statusEl.textContent = "Your move (White)";
}

function onDragStart(source, piece) {
  if (game.game_over()) return false;
  if (piece.startsWith("b")) return false;
}

function onDrop(source, target) {
  let move = game.move({
    from: source,
    to: target,
    promotion: "q"
  });

  if (move === null) return "snapback";

  updateStatus();

  setTimeout(makeBotMove, 300);
}

function makeBotMove() {
  if (game.game_over()) return;

  if (botType === "stockfish") {
    stockfishMove();
    return;
  }

  let moves = game.moves({ verbose: true });

  let move;
  switch (botType) {
    case "easy":
      move = randomMove(moves);
      break;
    case "aggressive":
      move = aggressiveMove(moves);
      break;
    case "defensive":
      move = defensiveMove(moves);
      break;
    case "strong":
      move = minimaxRoot(2, game, true);
      break;
  }

  game.move(move);
  board.position(game.fen());
  updateStatus();
}

function randomMove(moves) {
  return moves[Math.floor(Math.random() * moves.length)];
}

function aggressiveMove(moves) {
  let captures = moves.filter(m => m.captured);
  return captures.length ? randomMove(captures) : randomMove(moves);
}

function defensiveMove(moves) {
  let safeMoves = moves.filter(m => !m.captured);
  return safeMoves.length ? randomMove(safeMoves) : randomMove(moves);
}

/* ---------- Simple Minimax (Strong Bot) ---------- */

function minimaxRoot(depth, game, isMaximising) {
  let moves = game.moves({ verbose: true });
  let bestMove = null;
  let bestValue = -9999;

  for (let move of moves) {
    game.move(move);
    let value = minimax(depth - 1, game, -10000, 10000, !isMaximising);
    game.undo();

    if (value > bestValue) {
      bestValue = value;
      bestMove = move;
    }
  }
  return bestMove;
}

function minimax(depth, game, alpha, beta, isMaximising) {
  if (depth === 0) return evaluateBoard(game);

  let moves = game.moves({ verbose: true });

  if (isMaximising) {
    let best = -9999;
    for (let move of moves) {
      game.move(move);
      best = Math.max(best, minimax(depth - 1, game, alpha, beta, false));
      game.undo();
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = 9999;
    for (let move of moves) {
      game.move(move);
      best = Math.min(best, minimax(depth - 1, game, alpha, beta, true));
      game.undo();
      beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return best;
  }
}

function evaluateBoard(game) {
  let values = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  let board = game.board();
  let score = 0;

  for (let row of board) {
    for (let piece of row) {
      if (piece) {
        let value = values[piece.type];
        score += piece.color === "w" ? value : -value;
      }
    }
  }
  return score;
}

/* ---------- STOCKFISH FINAL BOSS ---------- */

function stockfishMove() {
  if (!stockfish) stockfish = Stockfish();

  stockfish.postMessage("uci");
  stockfish.postMessage("position fen " + game.fen());
  stockfish.postMessage("go depth 15");

  stockfish.onmessage = e => {
    let line = e.data;
    if (line.startsWith("bestmove")) {
      let move = line.split(" ")[1];
      game.move({
        from: move.substring(0, 2),
        to: move.substring(2, 4),
        promotion: "q"
      });
      board.position(game.fen());
      updateStatus();
    }
  };
}

function updateStatus() {
  if (game.in_checkmate()) {
    statusEl.textContent = "Checkmate!";
  } else if (game.in_draw()) {
    statusEl.textContent = "Draw!";
  } else {
    statusEl.textContent = game.turn() === "w" ? "Your move" : "Bot thinking...";
  }
}

/* ---------- INIT ---------- */

board = Chessboard("board", {
  draggable: true,
  position: "start",
  onDragStart,
  onDrop
});

updateStatus();
