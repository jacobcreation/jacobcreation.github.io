var game = new Chess();

var board = Chessboard("board", {
  draggable: true,
  position: "start",
  onDrop: onDrop
});

var engine = Stockfish();
engine.postMessage("uci");

var rating = document.getElementById("rating");
var time = document.getElementById("time");
var rv = document.getElementById("ratingValue");
var tv = document.getElementById("timeValue");

rv.textContent = rating.value;
tv.textContent = time.value;

rating.oninput = function () {
  rv.textContent = rating.value;
};

time.oninput = function () {
  tv.textContent = time.value;
};

function onDrop(source, target) {
  var move = game.move({
    from: source,
    to: target,
    promotion: "q"
  });

  if (move === null) return "snapback";

  setTimeout(makeEngineMove, 200);
}

function makeEngineMove() {
  if (game.game_over()) return;

  engine.postMessage("setoption name UCI_LimitStrength value true");
  engine.postMessage("setoption name UCI_Elo value " + rating.value);

  engine.postMessage("position fen " + game.fen());
  engine.postMessage("go movetime " + time.value);
}

engine.onmessage = function (event) {
  if (event.data.startsWith("bestmove")) {
    var move = event.data.split(" ")[1];

    game.move({
      from: move.substring(0, 2),
      to: move.substring(2, 4),
      promotion: "q"
    });

    board.position(game.fen());
  }
};

document.getElementById("reset").onclick = function () {
  game.reset();
  board.start();
};
