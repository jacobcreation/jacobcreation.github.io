// lightweight-chess.js
// Minimal chess logic for GitHub Pages (not full chess.js)

(function(global) {
  const FILES = ['a','b','c','d','e','f','g','h'];

  function Chess(fen) {
    this.board = initBoard();
    if (fen) loadFEN(this.board, fen);
  }

  function initBoard() {
    // 8x8 array with pieces or null
    const start = [
      "rnbqkbnr",
      "pppppppp",
      "........",
      "........",
      "........",
      "........",
      "PPPPPPPP",
      "RNBQKBNR"
    ];
    return start.map(row => row.split("").map(c => c === "." ? null : c));
  }

  function loadFEN(board, fen) {
    const rows = fen.split(" ")[0].split("/");
    for (let r=0; r<8; r++) {
      let row = [];
      for (let c of rows[r]) {
        if (!isNaN(c)) {
          for (let i=0; i<parseInt(c); i++) row.push(null);
        } else {
          row.push(c);
        }
      }
      board[r] = row;
    }
  }

  Chess.prototype.ascii = function() {
    return this.board.map(r => r.map(c => c || ".").join(" ")).join("\n");
  };

  Chess.prototype.get = function(square) {
    const file = FILES.indexOf(square[0]);
    const rank = 8 - parseInt(square[1]);
    return this.board[rank][file];
  };

  Chess.prototype.set = function(square, piece) {
    const file = FILES.indexOf(square[0]);
    const rank = 8 - parseInt(square[1]);
    this.board[rank][file] = piece;
  };

  Chess.prototype.move = function(from, to) {
    const piece = this.get(from);
    if (!piece) return false;
    this.set(to, piece);
    this.set(from, null);
    return true;
  };

  // Export
  global.LightChess = Chess;

})(this);
