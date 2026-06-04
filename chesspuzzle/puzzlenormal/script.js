let board = null;
let game = new Chess();
let userRating = parseInt(localStorage.getItem('chessPuzzleRating')) || 1500;
let currentPuzzle = null;
let solutionMoves = [];
let currentMoveIndex = 0;

let currentStreak = parseInt(localStorage.getItem('chessPuzzleStreak')) || 0;
let bestStreak = parseInt(localStorage.getItem('chessPuzzleBestStreak')) || 0;
let puzzleTimer = null;
let secondsElapsed = 0;
let currentThemeFilter = 'all';

const statusEl = $('#status');
const userRatingEl = $('#userRating');
const puzzleRatingEl = $('#puzzleRating');
const puzzleThemeEl = $('#puzzleTheme');
const puzzleResultEl = $('#puzzleResult');
const moveListEl = $('#moveList');

const currentStreakEl = $('#currentStreak');
const bestStreakEl = $('#bestStreak');
const timerEl = $('#timer');
const evalBarEl = $('#evalBar');

function updateRatingDisplay() {
    userRatingEl.text(userRating);
    localStorage.setItem('chessPuzzleRating', userRating);
    updateStreakDisplay();
    if (typeof ChessAccounts !== 'undefined' && ChessAccounts.isLoggedIn()) {
        ChessAccounts.syncCurrentLocalStats().catch(err => console.error("Failed to sync stats to worker:", err));
    }
}

function updateStreakDisplay() {
    currentStreakEl.text(currentStreak);
    bestStreakEl.text(bestStreak);
    localStorage.setItem('chessPuzzleStreak', currentStreak);
    localStorage.setItem('chessPuzzleBestStreak', bestStreak);
}

function startTimer() {
    clearInterval(puzzleTimer);
    secondsElapsed = 0;
    updateTimerDisplay();
    puzzleTimer = setInterval(() => {
        secondsElapsed++;
        updateTimerDisplay();
    }, 1000);
}

function stopTimer() {
    clearInterval(puzzleTimer);
}

function updateTimerDisplay() {
    const mins = Math.floor(secondsElapsed / 60).toString().padStart(2, '0');
    const secs = (secondsElapsed % 60).toString().padStart(2, '0');
    timerEl.text(`${mins}:${secs}`);
}

function updateEvalBar() {
    if (!currentPuzzle) return;
    let percentage = 50;
    const isPlayerWhite = board.orientation() === 'white';
    
    // In puzzles, the currentMoveIndex / solutionMoves.length tracks progress.
    // 0 is start, 1 is finished.
    let progress = currentMoveIndex / solutionMoves.length;
    
    if (isPlayerWhite) {
        // White starts slightly worse, goes to winning
        percentage = 40 + (progress * 55); // 40% to 95%
    } else {
        // Black starts slightly worse (so White is better, bar is higher)
        percentage = 60 - (progress * 55); // 60% to 5%
    }
    
    evalBarEl.css('height', percentage + '%');
}

function highlightLastMove(from, to) {
    $('.square-55d63').removeClass('highlight-move');
    $(`.square-${from}`).addClass('highlight-move');
    $(`.square-${to}`).addClass('highlight-move');
}

function clearHighlights() {
    $('.square-55d63').removeClass('highlight-move highlight-hint');
}

async function loadRandomPuzzle() {
    statusEl.text('Fetching puzzle...');
    
    try {
        const themeQuery = currentThemeFilter === 'all' ? '' : `&theme=${currentThemeFilter}`;
        const response = await fetch(`https://puzzle-gen.b4rjxr9lk.workers.dev/api/puzzle?rating=${userRating}${themeQuery}`);
        
        if (!response.ok) throw new Error(`Worker responded with ${response.status}`);
        
        const puzzleJson = await response.json();
        
        if (puzzleJson.error) throw new Error(puzzleJson.error);
        
        // Parse directly from the D1-backed JSON response
        parsePuzzle(puzzleJson);
        
    } catch (err) {
        console.error('Error loading puzzle:', err);
        statusEl.text('Failed to load puzzle. Retrying...');
        setTimeout(loadRandomPuzzle, 2000);
    }
}

// Accepts the JSON object returned by the puzzle-gen Cloudflare Worker (D1 database)
function parsePuzzle(puzzleJson) {
    currentPuzzle = {
        id: puzzleJson.PuzzleId,
        fen: puzzleJson.FEN,
        moves: puzzleJson.Moves.split(' '),
        rating: puzzleJson.Rating,
        themes: puzzleJson.Themes || ''
    };
    
    solutionMoves = currentPuzzle.moves;
    currentMoveIndex = 0;
    
    puzzleRatingEl.text(currentPuzzle.rating);
    puzzleThemeEl.text((currentPuzzle.themes).split(' ').filter(Boolean).slice(0, 3).join(', '));
    puzzleResultEl.text('Solving...');
    moveListEl.empty();
    
    clearHighlights();
    setupBoard();
}

function setupBoard() {
    game.load(currentPuzzle.fen);
    
    const config = {
        draggable: true,
        position: currentPuzzle.fen,
        orientation: game.turn() === 'w' ? 'white' : 'black',
        pieceTheme: 'img/chesspieces/wikipedia/{piece}.png',
        onDragStart: onDragStart,
        onDrop: onDrop,
        onSnapEnd: onSnapEnd
    };
    
    if (board) board.destroy();
    board = Chessboard('myBoard', config);
    
    // Play the first move of the puzzle (opponent's move)
    setTimeout(makeOpponentMove, 500);
    
    // Start timer and update eval bar
    startTimer();
    updateEvalBar();
}

function makeOpponentMove() {
    const moveStr = solutionMoves[currentMoveIndex];
    const move = game.move({
        from: moveStr.substring(0, 2),
        to: moveStr.substring(2, 4),
        promotion: moveStr.length > 4 ? moveStr.substring(4, 5) : 'q'
    });
    
    board.position(game.fen());
    highlightLastMove(moveStr.substring(0, 2), moveStr.substring(2, 4));
    addMoveToHistory(move ? move.san : moveStr, 'opponent');
    currentMoveIndex++;
    
    statusEl.text(game.turn() === 'w' ? 'White to move' : 'Black to move');
    updateEvalBar();
}

function onDragStart(source, piece, position, orientation) {
    if (game.game_over()) return false;
    
    // Only pick up pieces for the side to move
    if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
        (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
        return false;
    }
}

function onDrop(source, target) {
    // Only allow legal moves
    const moves = game.moves({ verbose: true });
    const isLegal = moves.some(m => m.from === source && m.to === target);
    if (!isLegal) {
        return 'snapback';
    }

    const expectedMove = solutionMoves[currentMoveIndex];
    const moveStr = source + target;
    
    if (moveStr !== expectedMove.substring(0, 4)) {
        if (moveStr + 'q' !== expectedMove && moveStr + 'r' !== expectedMove && moveStr + 'b' !== expectedMove && moveStr + 'n' !== expectedMove) {
            statusEl.text('Wrong move! Try again.');
            currentStreak = 0;
            updateStreakDisplay();
            return 'snapback';
        }
    }
    
    const move = game.move({
        from: source,
        to: target,
        promotion: expectedMove.length > 4 ? expectedMove.substring(4, 5) : 'q'
    });
    
    if (move === null) return 'snapback';
    
    highlightLastMove(source, target);
    currentMoveIndex++;
    addMoveToHistory(move ? move.san : expectedMove, 'user');
    
    if (currentMoveIndex < solutionMoves.length) {
        statusEl.text('Correct! Opponent is thinking...');
        updateEvalBar();
        setTimeout(makeOpponentMove, 800);
    } else {
        puzzleSolved();
    }
}

function onSnapEnd() {
    board.position(game.fen());
}

function addMoveToHistory(moveStr, side) {
    const item = $('<div>').addClass('move-item').text(moveStr);
    if (side === 'user') item.addClass('correct');
    moveListEl.append(item);
    moveListEl.scrollTop(moveListEl[0].scrollHeight);
}

function puzzleSolved() {
    statusEl.text('Puzzle Solved! Well done.');
    puzzleResultEl.text('Success!');
    stopTimer();
    
    currentStreak++;
    if (currentStreak > bestStreak) {
        bestStreak = currentStreak;
    }
    
    const puzzleRating = parseInt(currentPuzzle.rating);
    const diff = puzzleRating - userRating;
    const probability = 1 / (1 + Math.pow(10, diff / 400));
    const k = 32;
    const gain = Math.round(k * (1 - probability));
    
    userRating += gain;
    updateRatingDisplay();
    updateEvalBar();
    
    if (typeof confetti === 'function') {
        confetti({
            particleCount: 120,
            spread: 80,
            origin: { y: 0.6 }
        });
    }
}

function showSolution() {
    if (!currentPuzzle) return;
    statusEl.text('Solution shown.');
    puzzleResultEl.text('Failed');
    stopTimer();
    
    currentStreak = 0;
    updateStreakDisplay();
    
    game.load(currentPuzzle.fen);
    moveListEl.empty();
    clearHighlights();
    
    let i = 0;
    const interval = setInterval(() => {
        if (i >= solutionMoves.length) {
            clearInterval(interval);
            return;
        }
        const moveStr = solutionMoves[i];
        const move = game.move({
            from: moveStr.substring(0, 2),
            to: moveStr.substring(2, 4),
            promotion: moveStr.length > 4 ? moveStr.substring(4, 5) : 'q'
        });
        board.position(game.fen());
        highlightLastMove(moveStr.substring(0, 2), moveStr.substring(2, 4));
        addMoveToHistory(move ? move.san : moveStr, i % 2 === 0 ? 'opponent' : 'user');
        i++;
    }, 1000);
    
    userRating -= 15;
    if (userRating < 300) userRating = 300;
    updateRatingDisplay();
}

// Event Listeners
$('#nextPuzzleBtn').click(loadRandomPuzzle);

$('#hintBtn').click(() => {
    if (!currentPuzzle || currentMoveIndex >= solutionMoves.length) return;
    const hint = solutionMoves[currentMoveIndex].substring(0, 2);
    statusEl.text(`Hint: Try moving the piece on ${hint}`);
    
    $('.square-55d63').removeClass('highlight-hint');
    $(`.square-${hint}`).addClass('highlight-hint');
    
    setTimeout(() => {
        $(`.square-${hint}`).removeClass('highlight-hint');
    }, 2000);
});

$('#showSolutionBtn').click(showSolution);


$('#themeFilter').change(function() {
    currentThemeFilter = $(this).val();
    loadRandomPuzzle();
});

$(document).keydown(function(e) {
    
    if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        loadRandomPuzzle();
    } else if (e.key === 'h' || e.key === 'H') {
        $('#hintBtn').click();
    } else if (e.key === 's' || e.key === 'S') {
        $('#showSolutionBtn').click();
    }
});

// Init
if (typeof ChessAccounts !== 'undefined' && ChessAccounts.isLoggedIn()) {
    ChessAccounts.fetchAndSyncStats().then(() => {
        userRating = parseInt(localStorage.getItem('chessPuzzleRating')) || 1500;
        currentStreak = parseInt(localStorage.getItem('chessPuzzleStreak')) || 0;
        bestStreak = parseInt(localStorage.getItem('chessPuzzleBestStreak')) || 0;
        updateRatingDisplay();
        loadRandomPuzzle();
    }).catch(err => {
        console.error("Failed to sync stats during init:", err);
        updateRatingDisplay();
        loadRandomPuzzle();
    });
} else {
    updateRatingDisplay();
    loadRandomPuzzle();
}
