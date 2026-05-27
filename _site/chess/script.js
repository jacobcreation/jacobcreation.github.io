var STORAGE_KEY = "jacobcreation-chess-state-v2";
var STARTING_COUNTS = {
	w: { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 },
	b: { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 },
};
var PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
var PIECE_UNICODE = {
	w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
	b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" },
};
var PIECE_NAMES = { q: "Queen", r: "Rook", b: "Bishop", n: "Knight" };

var board = null;
var game = new Chess();
var stockfish = new Worker("lib/stockfish.js");
var audioContext = null;

var ui = {
	status: $("#status"),
	substatus: $("#substatus"),
	turnBadge: $("#turnBadge"),
	moveList: $("#moveList"),
	historyCount: $("#historyCount"),
	capturedBlack: $("#capturedBlack"),
	capturedWhite: $("#capturedWhite"),
	statMode: $("#statMode"),
	statSide: $("#statSide"),
	statMoveCount: $("#statMoveCount"),
	statMaterial: $("#statMaterial"),
	engineState: $("#engineState"),
	engineEval: $("#engineEval"),
	engineDepth: $("#engineDepth"),
	bestLine: $("#bestLine"),
	hintText: $("#hintText"),
	difficulty: $("#difficulty"),
	difficultyVal: $("#difficultyVal"),
	moveTime: $("#moveTime"),
	moveTimeVal: $("#moveTimeVal"),
	gameMode: $("#gameMode"),
	playerColor: $("#playerColor"),
	boardTheme: $("#boardTheme"),
	soundToggle: $("#soundToggle"),
	fenInput: $("#fenInput"),
	pgnInput: $("#pgnInput"),
	boardOverlay: $("#boardOverlay"),
	toast: $("#toast"),
	promotionModal: $("#promotionModal"),
	promotionChoices: $("#promotionChoices"),
};

var state = {
	gameMode: "ai",
	playerColor: "w",
	boardOrientation: "white",
	difficulty: 10,
	moveTime: 800,
	boardTheme: "classic",
	soundEnabled: true,
	engineReady: false,
	engineTask: null,
	engineTimer: null,
	engineTaskId: 0,
	hintMove: null,
	lastMove: null,
	legalSquares: [],
	selectedSquare: null,
	pendingPromotion: null,
	toastTimer: null,
	bestLineText: "Make a move or ask for a hint.",
	engineEvalText: "Waiting",
	engineDepthText: "--",
	restoredFromSave: false,
};

init();

function init() {
	restoreSavedState();
	initBoard();
	initEngine();
	bindUi();
	applySettingsToControls();
	applyTheme();
	syncBoard(false);
	updateAll();

	if (state.restoredFromSave) {
		showToast("Saved session restored.");
	}

	handleTurnTransition(200);
}

function initBoard() {
	board = Chessboard("myBoard", {
		draggable: true,
		position: game.fen(),
		pieceTheme: "img/chesspieces/wikipedia/{piece}.png",
		onDragStart: onDragStart,
		onDrop: onDrop,
		onSnapEnd: onSnapEnd,
		onMouseoverSquare: onMouseoverSquare,
		onMouseoutSquare: onMouseoutSquare,
	});

	board.orientation(state.boardOrientation);

	$(window).on(
		"resize",
		debounce(function () {
			board.resize();
			renderHighlights();
		}, 120),
	);
}

function initEngine() {
	stockfish.onmessage = onEngineMessage;
	stockfish.onerror = function () {
		setEngineState("Unavailable");
		ui.engineEval.text("Worker error");
		ui.bestLine.text("Stockfish worker could not be loaded.");
	};

	stockfish.postMessage("uci");
	sendEngineSkill();
	stockfish.postMessage("isready");
}

function bindUi() {
	$("#newGameBtn").on("click", function () {
		activateAudio();
		startNewGame();
	});

	$("#undoBtn").on("click", function () {
		activateAudio();
		undoMove();
	});

	$("#hintBtn").on("click", function () {
		activateAudio();
		requestHint();
	});

	$("#flipBoardBtn").on("click", function () {
		state.boardOrientation =
			state.boardOrientation === "white" ? "black" : "white";
		board.orientation(state.boardOrientation);
		renderHighlights();
		saveState();
	});

	ui.gameMode.on("change", function () {
		state.gameMode = $(this).val();
		clearHint();
		stopEngineTask();
		updateAll();
		handleTurnTransition(120);
	});

	ui.playerColor.on("change", function () {
		state.playerColor = $(this).val();
		state.boardOrientation = state.playerColor === "w" ? "white" : "black";
		board.orientation(state.boardOrientation);
		clearHint();
		stopEngineTask();
		updateAll();
		handleTurnTransition(120);
	});

	ui.boardTheme.on("change", function () {
		state.boardTheme = $(this).val();
		applyTheme();
		saveState();
	});

	ui.soundToggle.on("change", function () {
		state.soundEnabled = $(this).is(":checked");
		if (state.soundEnabled) {
			activateAudio();
		}
		saveState();
	});

	ui.difficulty.on("input change", function () {
		state.difficulty = parseInt($(this).val(), 10);
		ui.difficultyVal.text(state.difficulty);
		sendEngineSkill();
		saveState();
	});

	ui.moveTime.on("input change", function () {
		state.moveTime = parseInt($(this).val(), 10);
		ui.moveTimeVal.text(state.moveTime + " ms");
		saveState();
	});

	$("#copyFenBtn").on("click", function () {
		copyText(game.fen(), "FEN copied to clipboard.");
	});

	$("#copyPgnBtn").on("click", function () {
		copyText(
			game.pgn({ max_width: 80, newline_char: "\n" }),
			"PGN copied to clipboard.",
		);
	});

	$("#loadFenBtn").on("click", function () {
		activateAudio();
		loadFenFromInput();
	});

	$("#loadPgnBtn").on("click", function () {
		activateAudio();
		loadPgnFromInput();
	});

	$("#resetPositionBtn").on("click", function () {
		activateAudio();
		startNewGame();
	});

	$("#cancelPromotionBtn").on("click", function () {
		closePromotionModal();
	});
}

function onDragStart(source, piece) {
	activateAudio();

	if (state.pendingPromotion) {
		return false;
	}

	if (game.game_over()) {
		return false;
	}

	if (state.engineTask && state.engineTask.kind !== "move") {
		stopEngineTask();
	}

	if (isBoardLockedForEngine()) {
		return false;
	}

	if (!isPieceMovable(piece)) {
		return false;
	}

	showLegalMoves(source);
	return true;
}

function onDrop(source, target) {
	clearLegalHighlights();
	clearHint();

	if (source === target) {
		return;
	}

	if (requiresPromotion(source, target)) {
		openPromotionModal(source, target);
		return "snapback";
	}

	var move = game.move({
		from: source,
		to: target,
		promotion: "q",
	});

	if (move === null) {
		return "snapback";
	}

	handleSuccessfulMove(move, "human");
}

function onSnapEnd() {
	syncBoard(false);
}

function onMouseoverSquare(square, piece) {
	if (state.pendingPromotion || isBoardLockedForEngine()) {
		return;
	}

	if (!piece || !isPieceMovable(piece)) {
		return;
	}

	showLegalMoves(square);
}

function onMouseoutSquare() {
	clearLegalHighlights();
}

function onEngineMessage(event) {
	var line = String(event.data || "");

	if (line === "uciok" || line === "readyok") {
		state.engineReady = true;
		if (!state.engineTask) {
			setEngineState("Ready");
		}
		return;
	}

	if (line.indexOf("info ") === 0) {
		handleEngineInfo(line);
		return;
	}

	if (line.indexOf("bestmove ") === 0) {
		handleEngineBestMove(line);
	}
}

var lastInfoUpdate = 0;
function handleEngineInfo(line) {
	if (!state.engineTask) {
		return;
	}

	var depthMatch = line.match(/\bdepth\s+(\d+)/);
	var scoreMatch = line.match(/\bscore\s+(cp|mate)\s+(-?\d+)/);
	var pvMatch = line.match(/\bpv\s+(.+)/);

	var now = Date.now();
	var shouldUpdateUi = now - lastInfoUpdate > 100;

	if (depthMatch) {
		state.engineDepthText = depthMatch[1];
	}

	if (scoreMatch) {
		state.engineEvalText = formatEngineScore(
			scoreMatch[1],
			parseInt(scoreMatch[2], 10),
			state.engineTask.fen,
		);
	}

	if (pvMatch) {
		state.bestLineText = formatPvLine(state.engineTask.fen, pvMatch[1]);
	}

	if (shouldUpdateUi) {
		lastInfoUpdate = now;
	}
}

function handleEngineBestMove(line) {
	var task = state.engineTask;
	var bestMove = line.split(" ")[1];

	state.engineTask = null;
	clearEngineTimer();
	updateBoardLock();

	if (!task || bestMove === "(none)") {
		setEngineState("Idle");
		return;
	}

	if (task.kind === "move") {
		setEngineState("Moving");
		makeEngineMove(bestMove);
		return;
	}

	if (task.kind === "hint") {
		applyHint(bestMove, task.fen);
		setEngineState("Hint ready");
		return;
	}

	if (task.kind === "analysis") {
		setEngineState("Ready");
	}
}

function makeEngineMove(moveString) {
	var move = uciToMove(game, moveString);
	if (!move) {
		showToast("Stockfish returned an invalid move.");
		updateAll();
		return;
	}

	var applied = game.move(move);
	if (!applied) {
		showToast("Stockfish move could not be applied.");
		updateAll();
		return;
	}

	handleSuccessfulMove(applied, "engine");
}

function handleSuccessfulMove(move, source) {
	state.lastMove = {
		from: move.from,
		to: move.to,
	};

	resetAnalysisOutput(
		game.game_over() ? "Game over." : "Refreshing analysis...",
	);
	syncBoard(false);
	updateAll();
	playMoveSound(move);

	if (source === "engine") {
		showToast("Stockfish played " + move.san + ".");
	}

	handleTurnTransition(source === "engine" ? 120 : 220);
}

function handleTurnTransition(delay) {
	stopEngineTask();

	if (state.pendingPromotion) {
		return;
	}

	if (shouldEngineMove()) {
		scheduleEngineMove(delay || 120);
	} else {
		scheduleAnalysis(delay || 120);
	}
}

function scheduleEngineMove(delay) {
	clearEngineTimer();
	setEngineState("Thinking");
	updateBoardLock();

	state.engineTimer = window.setTimeout(function () {
		if (!shouldEngineMove()) {
			setEngineState("Idle");
			updateBoardLock();
			return;
		}

		startEngineTask("move", game.fen(), state.moveTime);
	}, delay || 120);
}

function scheduleAnalysis(delay) {
	clearEngineTimer();

	if (game.game_over()) {
		setEngineState("Game over");
		return;
	}

	state.engineTimer = window.setTimeout(function () {
		if (shouldEngineMove() || state.pendingPromotion) {
			return;
		}

		startEngineTask(
			"analysis",
			game.fen(),
			Math.min(Math.max(state.moveTime, 300), 1200),
		);
	}, delay || 150);
}

function startEngineTask(kind, fen, moveTime) {
	if (!state.engineReady) {
		setEngineState("Starting");
	}

	state.engineTaskId += 1;
	state.engineTask = {
		id: state.engineTaskId,
		kind: kind,
		fen: fen,
	};

	if (kind === "move") {
		setEngineState("Thinking");
		updateBoardLock();
	} else if (kind === "hint") {
		setEngineState("Finding hint");
	} else {
		setEngineState("Analyzing");
	}

	sendEngineSkill();
	stockfish.postMessage("position fen " + fen);
	stockfish.postMessage("go movetime " + moveTime);
}

function stopEngineTask() {
	clearEngineTimer();

	if (state.engineTask) {
		stockfish.postMessage("stop");
		state.engineTask = null;
	}

	updateBoardLock();
	if (!game.game_over()) {
		setEngineState("Idle");
	}
}

function clearEngineTimer() {
	if (state.engineTimer) {
		window.clearTimeout(state.engineTimer);
		state.engineTimer = null;
	}
}

function requestHint() {
	if (game.game_over()) {
		showToast("The game is already finished.");
		return;
	}

	if (shouldEngineMove()) {
		showToast("Wait for Stockfish to finish its move first.");
		return;
	}

	clearHint();
	stopEngineTask();
	startEngineTask(
		"hint",
		game.fen(),
		Math.min(Math.max(state.moveTime, 400), 1500),
	);
}

function applyHint(bestMove, fen) {
	var hint = uciToMove(new Chess(fen), bestMove);
	var tempGame = new Chess(fen);
	var applied = hint ? tempGame.move(hint) : null;

	if (!applied) {
		ui.hintText.text("Hint unavailable for this position.");
		return;
	}

	state.hintMove = {
		from: applied.from,
		to: applied.to,
	};

	ui.hintText.text(
		applied.san + " (" + applied.from + " to " + applied.to + ")",
	);
	renderHighlights();
}

function clearHint() {
	state.hintMove = null;
	ui.hintText.text("No hint loaded.");
	renderHighlights();
}

function startNewGame() {
	stopEngineTask();
	closePromotionModal();
	clearHint();
	game.reset();
	stockfish.postMessage("ucinewgame");
	state.lastMove = null;
	resetAnalysisOutput("Fresh board ready for analysis.");
	syncBoard(false);
	updateAll();
	showToast("Fresh board ready.");
	handleTurnTransition(180);
}

function undoMove() {
	if (state.pendingPromotion) {
		closePromotionModal();
	}

	stopEngineTask();

	var plies = state.gameMode === "ai" ? 2 : 1;
	var undone = 0;

	while (plies > 0) {
		var move = game.undo();
		if (!move) {
			break;
		}
		undone += 1;
		plies -= 1;
	}

	if (!undone) {
		showToast("No moves to undo.");
		return;
	}

	syncLastMoveFromHistory();
	clearHint();
	resetAnalysisOutput(
		game.game_over() ? "Game over." : "Refreshing analysis...",
	);
	syncBoard(false);
	updateAll();
	handleTurnTransition(120);
}

function loadFenFromInput() {
	var fen = ui.fenInput.val().trim();
	var validation = game.validate_fen(fen);

	if (!fen) {
		showToast("Paste a FEN first.");
		return;
	}

	if (!validation.valid) {
		showToast(validation.error);
		return;
	}

	stopEngineTask();
	closePromotionModal();
	clearHint();
	game.load(fen);
	state.lastMove = null;
	resetAnalysisOutput("Loaded FEN. Analyzing position...");
	syncBoard(false);
	updateAll();
	showToast("FEN loaded.");
	handleTurnTransition(140);
}

function loadPgnFromInput() {
	var pgn = ui.pgnInput.val().trim();
	var nextGame = new Chess();

	if (!pgn) {
		showToast("Paste a PGN first.");
		return;
	}

	if (!nextGame.load_pgn(pgn, { sloppy: true })) {
		showToast("That PGN could not be parsed.");
		return;
	}

	stopEngineTask();
	closePromotionModal();
	clearHint();
	game = nextGame;
	syncLastMoveFromHistory();
	resetAnalysisOutput(
		game.game_over()
			? "Loaded finished game."
			: "Loaded PGN. Analyzing position...",
	);
	syncBoard(false);
	updateAll();
	showToast("PGN loaded.");
	handleTurnTransition(140);
}

function syncLastMoveFromHistory() {
	var verboseHistory = game.history({ verbose: true });
	var last = verboseHistory.length
		? verboseHistory[verboseHistory.length - 1]
		: null;
	state.lastMove = last ? { from: last.from, to: last.to } : null;
}

function showLegalMoves(square) {
	clearLegalHighlights();

	var moves = game.moves({ square: square, verbose: true });
	if (!moves.length) {
		return;
	}

	state.selectedSquare = square;
	state.legalSquares = moves.map(function (move) {
		return move.to;
	});
	renderHighlights();
}

function clearLegalHighlights() {
	state.selectedSquare = null;
	state.legalSquares = [];
	renderHighlights();
}

function renderHighlights() {
	var $squares = $("#myBoard .square-55d63");
	$squares.removeClass("is-legal is-source is-last is-hint is-check");

	if (state.selectedSquare) {
		squareElement(state.selectedSquare).addClass("is-source");
	}

	state.legalSquares.forEach(function (square) {
		squareElement(square).addClass("is-legal");
	});

	if (state.lastMove) {
		squareElement(state.lastMove.from).addClass("is-last");
		squareElement(state.lastMove.to).addClass("is-last");
	}

	if (state.hintMove) {
		squareElement(state.hintMove.from).addClass("is-hint");
		squareElement(state.hintMove.to).addClass("is-hint");
	}

	if (game.in_check()) {
		squareElement(findKingSquare(game.turn())).addClass("is-check");
	}
}

function squareElement(square) {
	return $("#myBoard .square-" + square);
}

function updateAll() {
	updateStatus();
	updateMoveHistory();
	updateCapturedPieces();
	updateStats();
	updatePositionTools();
	renderHighlights();
	updateBoardLock();
	saveState();
}

function updateStatus() {
	var turnColor = game.turn() === "w" ? "White" : "Black";
	var statusText = turnColor + " to move";
	var detailText = "";

	if (game.in_checkmate()) {
		var winner = game.turn() === "w" ? "Black" : "White";
		statusText = "Checkmate";
		detailText = winner + " wins the game.";
		ui.turnBadge.text("Finished");
	} else if (game.in_stalemate()) {
		statusText = "Stalemate";
		detailText = "No legal moves remain.";
		ui.turnBadge.text("Draw");
	} else if (game.insufficient_material()) {
		statusText = "Draw";
		detailText = "Insufficient material to force mate.";
		ui.turnBadge.text("Draw");
	} else if (game.in_threefold_repetition()) {
		statusText = "Draw";
		detailText = "Threefold repetition detected.";
		ui.turnBadge.text("Draw");
	} else if (game.in_draw()) {
		statusText = "Draw";
		detailText = "Fifty-move rule or drawn position.";
		ui.turnBadge.text("Draw");
	} else {
		if (game.in_check()) {
			statusText = turnColor + " is in check";
		}

		if (state.pendingPromotion) {
			detailText = "Choose a promotion piece to continue.";
		} else if (state.gameMode === "ai") {
			if (game.turn() === state.playerColor) {
				detailText =
					"You control " + colorName(state.playerColor) + " against Stockfish.";
			} else {
				detailText = "Stockfish is controlling " + colorName(game.turn()) + ".";
			}
		} else {
			detailText = "Local mode is live. Both sides are unlocked.";
		}

		ui.turnBadge.text(turnColor);
	}

	ui.status.text(statusText);
	ui.substatus.text(detailText);
}

function updateMoveHistory() {
	var history = game.history();
	ui.moveList.empty();

	if (!history.length) {
		ui.moveList.append(
			'<div class="move-row"><div class="move-number">1.</div><div class="move-cell">-</div><div class="move-cell">-</div></div>',
		);
	} else {
		for (var i = 0; i < history.length; i += 2) {
			var moveNumber = Math.floor(i / 2) + 1;
			var whiteMove = history[i] || "";
			var blackMove = history[i + 1] || "";
			var whiteClass = i === history.length - 1 ? " current" : "";
			var blackClass = i + 1 === history.length - 1 ? " current" : "";

			ui.moveList.append(
				'<div class="move-row">' +
					'<div class="move-number">' +
					moveNumber +
					".</div>" +
					'<div class="move-cell' +
					whiteClass +
					'">' +
					escapeHtml(whiteMove || "-") +
					"</div>" +
					'<div class="move-cell' +
					blackClass +
					'">' +
					escapeHtml(blackMove || "-") +
					"</div>" +
					"</div>",
			);
		}
	}

	ui.historyCount.text(
		history.length + (history.length === 1 ? " move" : " moves"),
	);

	var node = ui.moveList.get(0);
	if (node) {
		node.scrollTop = node.scrollHeight;
	}
}

function updateCapturedPieces() {
	renderCapturedSet("b", ui.capturedBlack);
	renderCapturedSet("w", ui.capturedWhite);
}

function renderCapturedSet(colorLost, $target) {
	var counts = getRemainingPieceCounts();
	var html = "";
	var order = ["q", "r", "b", "n"];
	var pawns = [];
	var i;

	order.forEach(function (piece) {
		var missing = STARTING_COUNTS[colorLost][piece] - counts[colorLost][piece];
		if (missing > 0) {
			html += repeatPiece(colorLost, piece, missing);
		}
	});

	for (i = 0; i < STARTING_COUNTS[colorLost].p - counts[colorLost].p; i += 1) {
		pawns.push(renderPieceSymbol(colorLost, "p"));
	}

	html += pawns.join("");
	$target.html(html || '<span class="label">None yet</span>');
}

function repeatPiece(color, piece, count) {
	var html = "";
	for (var i = 0; i < count; i += 1) {
		html += renderPieceSymbol(color, piece);
	}
	return html;
}

function renderPieceSymbol(color, piece) {
	var tone = color === "w" ? "light" : "dark";
	return (
		'<span class="captured-piece ' +
		tone +
		'">' +
		PIECE_UNICODE[color][piece] +
		"</span>"
	);
}

function updateStats() {
	ui.statMode.text(state.gameMode === "ai" ? "Vs Stockfish" : "Local 2-Player");
	ui.statSide.text(
		state.gameMode === "ai" ? colorName(state.playerColor) : "Both sides",
	);
	ui.statMoveCount.text(game.history().length);
	ui.statMaterial.text(getMaterialSummary());
	ui.engineEval.text(state.engineEvalText);
	ui.engineDepth.text(state.engineDepthText);
	ui.bestLine.text(state.bestLineText);
}

function resetAnalysisOutput(message) {
	state.engineEvalText = game.game_over() ? "Finished" : "Waiting";
	state.engineDepthText = "--";
	state.bestLineText = message || "Make a move or ask for a hint.";
}

function updatePositionTools() {
	var active = document.activeElement;
	var fen = game.fen();
	var pgn = game.pgn({ max_width: 80, newline_char: "\n" });

	if (active !== ui.fenInput.get(0)) {
		ui.fenInput.val(fen);
	}

	if (active !== ui.pgnInput.get(0)) {
		ui.pgnInput.val(pgn);
	}
}

function updateBoardLock() {
	var locked = isBoardLockedForEngine();
	ui.boardOverlay.prop("hidden", !locked);
}

function isBoardLockedForEngine() {
	return Boolean(state.engineTask && state.engineTask.kind === "move");
}

function openPromotionModal(source, target) {
	state.pendingPromotion = {
		from: source,
		to: target,
		color: game.turn(),
	};

	var pieces = ["q", "r", "b", "n"];
	var html = "";

	pieces.forEach(function (piece) {
		html +=
			'<button class="promotion-choice" type="button" data-piece="' +
			piece +
			'">' +
			PIECE_UNICODE[state.pendingPromotion.color][piece] +
			"</button>";
	});

	ui.promotionChoices.html(html);
	ui.promotionChoices.find("button").on("click", function () {
		var piece = $(this).data("piece");
		completePromotion(piece);
	});

	ui.promotionModal.prop("hidden", false);
}

function completePromotion(piece) {
	if (!state.pendingPromotion) {
		return;
	}

	var move = game.move({
		from: state.pendingPromotion.from,
		to: state.pendingPromotion.to,
		promotion: piece,
	});

	closePromotionModal();

	if (!move) {
		showToast("Promotion move failed.");
		return;
	}

	showToast("Promoted to " + PIECE_NAMES[piece] + ".");
	handleSuccessfulMove(move, "human");
}

function closePromotionModal() {
	state.pendingPromotion = null;
	ui.promotionModal.prop("hidden", true);
}

function requiresPromotion(source, target) {
	var piece = game.get(source);
	if (!piece || piece.type !== "p") {
		return false;
	}

	return (
		(piece.color === "w" && target.charAt(1) === "8") ||
		(piece.color === "b" && target.charAt(1) === "1")
	);
}

function shouldEngineMove() {
	return (
		state.gameMode === "ai" &&
		!game.game_over() &&
		!state.pendingPromotion &&
		game.turn() !== state.playerColor
	);
}

function isPieceMovable(piece) {
	var pieceColor = piece.charAt(0) === "w" ? "w" : "b";
	if (pieceColor !== game.turn()) {
		return false;
	}

	if (state.gameMode === "local") {
		return true;
	}

	return pieceColor === state.playerColor;
}

function sendEngineSkill() {
	stockfish.postMessage("setoption name Skill Level value " + state.difficulty);
}

function setEngineState(label) {
	ui.engineState.text(label);
}

function syncBoard(animate) {
	board.position(game.fen(), Boolean(animate));
	board.orientation(state.boardOrientation);
	renderHighlights();
}

function applyTheme() {
	document.body.setAttribute("data-theme", state.boardTheme);
}

function applySettingsToControls() {
	ui.gameMode.val(state.gameMode);
	ui.playerColor.val(state.playerColor);
	ui.boardTheme.val(state.boardTheme);
	ui.soundToggle.prop("checked", state.soundEnabled);
	ui.difficulty.val(state.difficulty);
	ui.difficultyVal.text(state.difficulty);
	ui.moveTime.val(state.moveTime);
	ui.moveTimeVal.text(state.moveTime + " ms");
}

function getRemainingPieceCounts() {
	var counts = {
		w: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
		b: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
	};

	game.board().forEach(function (rank) {
		rank.forEach(function (square) {
			if (!square) {
				return;
			}

			counts[square.color][square.type] += 1;
		});
	});

	return counts;
}

function getMaterialSummary() {
	var counts = getRemainingPieceCounts();
	var white = 0;
	var black = 0;

	Object.keys(PIECE_VALUES).forEach(function (piece) {
		white += counts.w[piece] * PIECE_VALUES[piece];
		black += counts.b[piece] * PIECE_VALUES[piece];
	});

	if (white === black) {
		return "Even";
	}

	return white > black
		? "White +" + (white - black)
		: "Black +" + (black - white);
}

function formatEngineScore(kind, rawValue, fen) {
	var sideToMove = fen.split(" ")[1];
	var whitePerspective = sideToMove === "w" ? rawValue : -rawValue;

	if (kind === "mate") {
		if (whitePerspective > 0) {
			return "Mate for White in " + Math.abs(whitePerspective);
		}
		return "Mate for Black in " + Math.abs(whitePerspective);
	}

	if (whitePerspective === 0) {
		return "Equal";
	}

	var points = Math.abs(whitePerspective / 100)
		.toFixed(2)
		.replace(/\.00$/, "");
	return whitePerspective > 0 ? "White +" + points : "Black +" + points;
}

function formatPvLine(fen, pv) {
	var moves = pv.trim().split(/\s+/);
	var tempGame = new Chess(fen);
	var sanMoves = [];

	for (var i = 0; i < moves.length && sanMoves.length < 8; i += 1) {
		var move = uciToMove(tempGame, moves[i]);
		var applied = move ? tempGame.move(move) : null;

		if (!applied) {
			break;
		}

		sanMoves.push(applied.san);
	}

	return sanMoves.join(" ") || pv;
}

function uciToMove(chessGame, moveString) {
	if (!moveString || moveString.length < 4) {
		return null;
	}

	return {
		from: moveString.slice(0, 2),
		to: moveString.slice(2, 4),
		promotion: moveString.slice(4, 5) || "q",
	};
}

function findKingSquare(color) {
	var boardState = game.board();
	for (var rank = 0; rank < boardState.length; rank += 1) {
		for (var file = 0; file < boardState[rank].length; file += 1) {
			var piece = boardState[rank][file];
			if (piece && piece.type === "k" && piece.color === color) {
				return "abcdefgh".charAt(file) + String(8 - rank);
			}
		}
	}

	return null;
}

function colorName(color) {
	return color === "w" ? "White" : "Black";
}

function activateAudio() {
	if (!state.soundEnabled) {
		return;
	}

	var AudioCtx = window.AudioContext || window.webkitAudioContext;
	if (!AudioCtx) {
		return;
	}

	if (!audioContext) {
		audioContext = new AudioCtx();
	}

	if (audioContext.state === "suspended") {
		audioContext.resume();
	}
}

function playMoveSound(move) {
	if (!state.soundEnabled) {
		return;
	}

	activateAudio();

	if (!audioContext) {
		return;
	}

	if (game.game_over()) {
		playTone(330, 0.1, "triangle", 0.035);
		playTone(220, 0.18, "triangle", 0.035, 0.12);
		return;
	}

	if (move.captured) {
		playTone(220, 0.08, "square", 0.03);
		playTone(160, 0.1, "triangle", 0.028, 0.09);
		return;
	}

	if (game.in_check()) {
		playTone(520, 0.06, "sawtooth", 0.02);
		playTone(660, 0.08, "triangle", 0.022, 0.05);
		return;
	}

	playTone(420, 0.06, "sine", 0.02);
}

function playTone(frequency, duration, type, volume, delay) {
	if (!audioContext) {
		return;
	}

	var start = audioContext.currentTime + (delay || 0);
	var oscillator = audioContext.createOscillator();
	var gain = audioContext.createGain();

	oscillator.type = type || "sine";
	oscillator.frequency.value = frequency;
	gain.gain.value = volume || 0.02;
	gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

	oscillator.connect(gain);
	gain.connect(audioContext.destination);
	oscillator.start(start);
	oscillator.stop(start + duration);
}

function showToast(message) {
	ui.toast.text(message).prop("hidden", false);
	window.clearTimeout(state.toastTimer);
	state.toastTimer = window.setTimeout(function () {
		ui.toast.prop("hidden", true);
	}, 2200);
}

function copyText(text, successMessage) {
	var value = text || "";

	if (!value) {
		showToast("Nothing to copy yet.");
		return;
	}

	if (navigator.clipboard && navigator.clipboard.writeText) {
		navigator.clipboard
			.writeText(value)
			.then(function () {
				showToast(successMessage);
			})
			.catch(function () {
				fallbackCopy(value, successMessage);
			});
		return;
	}

	fallbackCopy(value, successMessage);
}

function fallbackCopy(text, successMessage) {
	var temp = $("<textarea>").val(text).css({
		position: "fixed",
		left: "-9999px",
		top: "0",
	});

	$("body").append(temp);
	temp.get(0).focus();
	temp.get(0).select();
	document.execCommand("copy");
	temp.remove();
	showToast(successMessage);
}

function saveState() {
	try {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				gameMode: state.gameMode,
				playerColor: state.playerColor,
				boardOrientation: state.boardOrientation,
				difficulty: state.difficulty,
				moveTime: state.moveTime,
				boardTheme: state.boardTheme,
				soundEnabled: state.soundEnabled,
				fen: game.fen(),
				pgn: game.pgn({ max_width: 80, newline_char: "\n" }),
				lastMove: state.lastMove,
			}),
		);
	} catch (error) {
		console.warn("Unable to save state:", error);
	}
}

function restoreSavedState() {
	try {
		var raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) {
			return;
		}

		var saved = JSON.parse(raw);
		if (!saved || typeof saved !== "object") {
			return;
		}

		state.gameMode = saved.gameMode || state.gameMode;
		state.playerColor = saved.playerColor || state.playerColor;
		state.boardOrientation =
			saved.boardOrientation || (state.playerColor === "w" ? "white" : "black");
		state.difficulty = clampNumber(saved.difficulty, 0, 20, state.difficulty);
		state.moveTime = clampNumber(saved.moveTime, 100, 2500, state.moveTime);
		state.boardTheme = saved.boardTheme || state.boardTheme;
		state.soundEnabled = saved.soundEnabled !== false;
		state.lastMove = saved.lastMove || null;

		if (saved.pgn) {
			var restored = new Chess();
			if (restored.load_pgn(saved.pgn, { sloppy: true })) {
				game = restored;
				state.restoredFromSave = true;
				syncLastMoveFromHistory();
				return;
			}
		}

		if (saved.fen) {
			game.load(saved.fen);
			state.restoredFromSave = true;
		}
	} catch (error) {
		console.warn("Unable to restore saved state:", error);
	}
}

function clampNumber(value, min, max, fallback) {
	var num = parseInt(value, 10);
	if (isNaN(num)) {
		return fallback;
	}
	return Math.min(Math.max(num, min), max);
}

function escapeHtml(value) {
	return String(value)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function debounce(fn, delay) {
	var timeout = null;
	return function () {
		var args = arguments;
		window.clearTimeout(timeout);
		timeout = window.setTimeout(function () {
			fn.apply(null, args);
		}, delay);
	};
}
