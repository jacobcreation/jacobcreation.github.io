// Web Audio Synth for Chess Sound Effects
class AudioSynth {
    constructor() {
        this.ctx = null;
        this.muted = localStorage.getItem('chessStormMuted') === 'true';
    }

    init() {
        if (this.ctx) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.error("Web Audio API not supported:", e);
        }
    }

    toggleMute() {
        this.muted = !this.muted;
        localStorage.setItem('chessStormMuted', this.muted);
        return this.muted;
    }

    playMove() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;
        
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(70, now + 0.08);
        
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        
        osc.start(now);
        osc.stop(now + 0.08);
    }

    playCapture() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;
        
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.12);
        
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        
        osc.start(now);
        osc.stop(now + 0.12);
    }

    playCorrect() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;
        
        const now = this.ctx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + idx * 0.06);
            
            gain.gain.setValueAtTime(0.12, now + idx * 0.06);
            gain.gain.exponentialRampToValueAtTime(0.005, now + idx * 0.06 + 0.14);
            
            osc.start(now + idx * 0.06);
            osc.stop(now + idx * 0.06 + 0.14);
        });
    }

    playError() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;
        
        const now = this.ctx.currentTime;
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(120, now);
        osc1.frequency.linearRampToValueAtTime(80, now + 0.22);
        
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(125, now);
        osc2.frequency.linearRampToValueAtTime(85, now + 0.22);
        
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.005, now + 0.22);
        
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.22);
        osc2.stop(now + 0.22);
    }

    playMilestone() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;
        
        const now = this.ctx.currentTime;
        const frequencies = [660, 990, 1320, 1650]; // E5 base metallic chime
        frequencies.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            
            osc.type = 'sine';
            osc.frequency.value = freq;
            
            const vol = 0.1 / (idx + 1);
            gain.gain.setValueAtTime(vol, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55 - (idx * 0.08));
            
            osc.start(now);
            osc.stop(now + 0.55);
        });
    }

    playTick() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1400, this.ctx.currentTime);
        
        gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.02);
        
        osc.start();
        osc.stop(this.ctx.currentTime + 0.02);
    }

    playGameOver() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;
        
        const now = this.ctx.currentTime;
        const notes = [261.63, 329.63, 392.00, 523.25, 659.25]; // C major chord arpeggio
        notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + idx * 0.08);
            
            gain.gain.setValueAtTime(0.12, now + idx * 0.08);
            gain.gain.exponentialRampToValueAtTime(0.005, now + idx * 0.08 + 0.45);
            
            osc.start(now + idx * 0.08);
            osc.stop(now + idx * 0.08 + 0.45);
        });
    }
}

// Global Variables
let board = null;
const game = new Chess();
const synth = new AudioSynth();

// Game States: 'LOBBY', 'COUNTDOWN', 'PLAYING', 'GAMEOVER'
let gameState = 'LOBBY';

// Stats & Scoring
let score = 0;
let currentStreak = 0;
let bestStreak = 0;
let strikes = 0;
const MAX_STRIKES = 3;
let baseTargetRating = 600; // Starts at rating 600
let maxRatingSolved = 0;
let totalSolvedThisRun = 0;
let totalPuzzlesThisRun = 0;

// Timer Config
let gameTimer = null;
let secondsRemaining = 180; // 3 minutes standard
const TOTAL_START_TIME = 180;

// Preloaded puzzle queue
const puzzleQueue = [];
const MAX_QUEUE_SIZE = 5;
let queueFilling = false;
const recentlyPlayedIds = new Set();

// Active puzzle data
let currentPuzzle = null;
let solutionMoves = [];
let currentMoveIndex = 0;
let playedPuzzles = []; // Array of { puzzle, correct: bool }
let reviewMode = false;
let reviewIndex = -1;
let userInteractionBlocked = false;

// DOM Elements cache
const startOverlay = $('#startOverlay');
const countdownOverlay = $('#countdownOverlay');
const countdownNumber = $('#countdownNumber');
const gameOverOverlay = $('#gameOverOverlay');
const startStormBtn = $('#startStormBtn');
const timerDisplay = $('#timerDisplay');
const timerProgressBar = $('#timerProgressBar');
const scoreDisplay = $('#scoreDisplay');
const streakDisplay = $('#streakDisplay');
const streakMeterBar = $('#streakMeterBar');
const streakFeedback = $('#streakFeedback');
const statusAlert = $('#statusAlert');
const runHistoryList = $('#runHistoryList');
const targetRatingVal = $('#targetRatingVal');
const themeDisplay = $('#themeDisplay');
const moveProgressBar = $('#moveProgressBar');
const muteBtn = $('#muteBtn');

// Local storage keys
const PB_KEY = 'chessStormHighScore';
const TOTAL_PLAYED_KEY = 'chessStormTotalPlayedCount';

// Initialize Game
$(document).ready(() => {
    if (typeof ChessAccounts !== 'undefined' && ChessAccounts.isLoggedIn()) {
        ChessAccounts.fetchAndSyncStats().then(() => {
            loadLobbyStats();
        }).catch(err => {
            console.error("Failed to sync stats in storm init:", err);
            loadLobbyStats();
        });
    } else {
        loadLobbyStats();
    }
    updateMuteButtonDisplay();
    
    // Fill the puzzle queue immediately in the background
    fillQueue();

    // Event listeners
    startStormBtn.click(startCountdown);
    $('#playAgainBtn').click(resetAndStartNewStorm);
    $('#abortBtn').click(abortRun);
    $('#muteBtn').click(toggleMute);
    
    // Keyboard listener
    $(document).keydown((e) => {
        if (e.key === ' ' || e.code === 'Space') {
            e.preventDefault();
            if (gameState === 'LOBBY' && !startStormBtn.prop('disabled')) {
                startCountdown();
            } else if (gameState === 'GAMEOVER') {
                resetAndStartNewStorm();
            }
        }
    });
});

function loadLobbyStats() {
    const pb = localStorage.getItem(PB_KEY) || 0;
    const totalCount = localStorage.getItem(TOTAL_PLAYED_KEY) || 0;
    $('#pbScore').text(pb);
    $('#totalPuzzlesPlayed').text(totalCount);
}

function updateMuteButtonDisplay() {
    muteBtn.text(synth.muted ? '🔇' : '🔊');
}

function toggleMute() {
    const isMuted = synth.toggleMute();
    updateMuteButtonDisplay();
}

// Preloader Queue Logic
async function fetchRandomPuzzle(targetRating) {
    const response = await fetch(`https://puzzle-gen.jacobcreation.workers.dev/api/puzzle?rating=${targetRating}`);
    if (!response.ok) throw new Error("Failed to fetch puzzle from API");
    
    const puzzleJson = await response.json();
    
    return {
        id: puzzleJson.PuzzleId,
        fen: puzzleJson.FEN,
        moves: puzzleJson.Moves.split(' '),
        rating: parseInt(puzzleJson.Rating),
        themes: puzzleJson.Themes
    };
}

async function fetchRandomPuzzleWithRetry(targetRating, maxAttempts = 15) {
    let attempts = 0;
    while (attempts < maxAttempts) {
        try {
            const puzzle = await fetchRandomPuzzle(targetRating);
            return puzzle;
        } catch (err) {
            attempts++;
        }
    }
    throw new Error("Failed to fetch puzzle after many attempts");
}

async function fillQueue() {
    if (queueFilling || puzzleQueue.length >= MAX_QUEUE_SIZE) return;
    queueFilling = true;
    
    while (puzzleQueue.length < MAX_QUEUE_SIZE) {
        // Increment target rating based on queue position offset
        const posOffset = puzzleQueue.length;
        const currentTarget = Math.max(300, Math.min(3400, baseTargetRating + posOffset * 40));
        
        try {
            const puzzle = await fetchRandomPuzzleWithRetry(currentTarget);
            
            // Check for duplicates
            if (puzzleQueue.some(p => p.id === puzzle.id) || recentlyPlayedIds.has(puzzle.id)) {
                continue;
            }
            
            puzzleQueue.push(puzzle);
            updateLobbyStartButton();
        } catch (e) {
            console.error("Queue preloader failed to fetch puzzle:", e);
            await new Promise(r => setTimeout(r, 400)); // Short pause before retry
        }
    }
    
    queueFilling = false;
}

function updateLobbyStartButton() {
    if (gameState !== 'LOBBY') return;
    
    if (puzzleQueue.length >= 3) {
        startStormBtn.prop('disabled', false);
        startStormBtn.html('Start Storm ⚡');
    } else {
        startStormBtn.prop('disabled', true);
        startStormBtn.html(`<span class="spinner"></span> Loading puzzles (${puzzleQueue.length}/${MAX_QUEUE_SIZE})...`);
    }
}

function triggerCountdownAnimation() {
    countdownNumber.css('animation', 'none');
    void countdownNumber[0].offsetWidth; // trigger reflow
    countdownNumber.css('animation', 'countdownDoubleFlash 1s ease-in-out');
}

// Gameplay Loop: Countdown Screen
function startCountdown() {
    if (puzzleQueue.length < 3) return;
    
    gameState = 'COUNTDOWN';
    startOverlay.addClass('hidden');
    countdownOverlay.removeClass('hidden');
    synth.init(); // Warm up Audio Context
    
    let count = 3;
    countdownNumber.text(count);
    synth.playTick();
    triggerCountdownAnimation();
    
    const countTimer = setInterval(() => {
        count--;
        if (count > 0) {
            countdownNumber.text(count);
            synth.playTick();
            triggerCountdownAnimation();
        } else if (count === 0) {
            countdownNumber.text("GO!");
            synth.playCorrect();
            triggerCountdownAnimation();
        } else {
            clearInterval(countTimer);
            countdownOverlay.addClass('hidden');
            startGameplay();
        }
    }, 1000);
}

function startGameplay() {
    gameState = 'PLAYING';
    score = 0;
    currentStreak = 0;
    bestStreak = 0;
    strikes = 0;
    secondsRemaining = TOTAL_START_TIME;
    playedPuzzles = [];
    recentlyPlayedIds.clear();
    
    // UI Resets
    scoreDisplay.text(score);
    streakDisplay.text(currentStreak);
    updateStreakMeter();
    resetStrikesDisplay();
    runHistoryList.empty();
    $('#historyCount').text('0 solved');
    
    updateTimerUI();
    
    // Start countdown timer loop
    startTimerLoop();
    
    // Load first puzzle from preloaded queue
    loadNextPuzzleFromQueue();
}

function startTimerLoop() {
    if (gameTimer) clearInterval(gameTimer);
    
    gameTimer = setInterval(() => {
        if (gameState !== 'PLAYING') {
            clearInterval(gameTimer);
            return;
        }
        
        secondsRemaining--;
        updateTimerUI();
        
        if (secondsRemaining <= 10 && secondsRemaining > 0) {
            timerDisplay.addClass('hurry');
            timerProgressBar.addClass('hurry');
            synth.playTick();
        }
        
        if (secondsRemaining <= 0) {
            clearInterval(gameTimer);
            endStormRun();
        }
    }, 1000);
}

function updateTimerUI() {
    const mins = Math.floor(Math.max(0, secondsRemaining) / 60).toString().padStart(2, '0');
    const secs = (Math.max(0, secondsRemaining) % 60).toString().padStart(2, '0');
    timerDisplay.text(`${mins}:${secs}`);
    
    const pct = Math.max(0, Math.min(100, (secondsRemaining / TOTAL_START_TIME) * 100));
    timerProgressBar.css('width', pct + '%');
    
    if (secondsRemaining > 10) {
        timerDisplay.removeClass('hurry');
        timerProgressBar.removeClass('hurry');
    }
}

function resetStrikesDisplay() {
    $('.strike-dot').removeClass('active');
}

function addStrike() {
    strikes++;
    $(`#strike-${strikes}`).addClass('active');
    
    // Red border alert flash
    statusAlert.text('Strike! Skipping puzzle...').addClass('wrong');
    synth.playError();
    
    if (strikes >= MAX_STRIKES) {
        setTimeout(endStormRun, 400);
    }
}

// Load and render puzzles
function loadNextPuzzleFromQueue() {
    if (gameState !== 'PLAYING') return;
    
    if (puzzleQueue.length === 0) {
        // Fallback: If network lag was too high and queue empty, show loader briefly
        statusAlert.text('Buffering next puzzle...');
        userInteractionBlocked = true;
        setTimeout(loadNextPuzzleFromQueue, 200);
        return;
    }
    
    userInteractionBlocked = false;
    currentPuzzle = puzzleQueue.shift();
    recentlyPlayedIds.add(currentPuzzle.id);
    
    // Fill queue in the background
    fillQueue();
    
    solutionMoves = currentPuzzle.moves;
    currentMoveIndex = 0;
    
    // Update labels
    targetRatingVal.text(currentPuzzle.rating);
    themeDisplay.text("Themes: " + currentPuzzle.themes.split(' ').slice(0, 3).join(', '));
    statusAlert.text('Opponent is thinking...').removeClass('correct wrong');
    
    updateMoveProgressBar();
    setupBoard();
}

function setupBoard() {
    game.load(currentPuzzle.fen);
    
    const userColor = game.turn() === 'w' ? 'black' : 'white';
    
    const config = {
        draggable: true,
        position: currentPuzzle.fen,
        orientation: userColor,
        pieceTheme: '../puzzlenormal/img/chesspieces/wikipedia/{piece}.png',
        onDragStart: onDragStart,
        onDrop: onDrop,
        onSnapEnd: onSnapEnd
    };
    
    if (board) board.destroy();
    board = Chessboard('myBoard', config);
    
    // Set user's turn direction text immediately
    statusAlert.text(userColor === 'white' ? 'White to move' : 'Black to move').removeClass('correct wrong');
    
    // Opponent makes their starting move
    userInteractionBlocked = true;
    setTimeout(makeOpponentMove, 400);
}

function makeOpponentMove() {
    if (gameState !== 'PLAYING' && !reviewMode) return;
    
    const moveStr = solutionMoves[currentMoveIndex];
    const fromSq = moveStr.substring(0, 2);
    const toSq = moveStr.substring(2, 4);
    const promo = moveStr.length > 4 ? moveStr.substring(4, 5) : null;
    
    const isCapture = game.get(toSq) !== null;
    
    const move = game.move({
        from: fromSq,
        to: toSq,
        promotion: promo || 'q'
    });
    
    board.position(game.fen());
    highlightSquares(fromSq, toSq, 'move');
    
    if (isCapture) {
        synth.playCapture();
    } else {
        synth.playMove();
    }
    
    currentMoveIndex++;
    userInteractionBlocked = false;
    
    statusAlert.text(game.turn() === 'w' ? 'White to move' : 'Black to move');
    updateMoveProgressBar();
}

function onDragStart(source, piece, position, orientation) {
    if (gameState !== 'PLAYING' && !reviewMode) return false;
    if (userInteractionBlocked) return false;
    if (game.game_over()) return false;
    
    // Only pick up piece of player's turn color
    if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
        (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
        return false;
    }
}

function onDrop(source, target) {
    if (userInteractionBlocked) return 'snapback';
    
    // Validate if move is legal in chess.js
    const legalMoves = game.moves({ verbose: true });
    const isLegal = legalMoves.some(m => m.from === source && m.to === target);
    if (!isLegal) return 'snapback';
    
    const expectedMove = solutionMoves[currentMoveIndex];
    const userMoveStr = source + target;
    
    // Verify against solution moves
    let isCorrect = false;
    if (userMoveStr === expectedMove.substring(0, 4)) {
        isCorrect = true;
    } else {
        // Check if there is a promotion mismatch
        const hasPromotion = expectedMove.length > 4;
        if (hasPromotion) {
            const promoLetter = expectedMove.substring(4, 5);
            if (userMoveStr + 'q' === expectedMove || userMoveStr + promoLetter === expectedMove) {
                isCorrect = true;
            }
        }
    }
    
    if (!isCorrect) {
        if (reviewMode) {
            synth.playError();
            statusAlert.text("Wrong move! Try again.").addClass('wrong');
            setTimeout(() => statusAlert.removeClass('wrong'), 800);
            return 'snapback';
        } else {
            // Wrong move in Game Mode - Strike and skip
            userInteractionBlocked = true;
            addStrike();
            
            playedPuzzles.push({
                puzzle: currentPuzzle,
                correct: false
            });
            
            currentStreak = 0;
            streakDisplay.text(currentStreak);
            updateStreakMeter();
            
            // Lower target rating for next puzzle preloading
            baseTargetRating = Math.max(600, baseTargetRating - 60);
            
            setTimeout(() => {
                if (gameState === 'PLAYING') {
                    loadNextPuzzleFromQueue();
                }
            }, 600);
            return 'snapback';
        }
    }
    
    // Correct Move!
    const promo = expectedMove.length > 4 ? expectedMove.substring(4, 5) : null;
    const isCapture = game.get(target) !== null;
    
    game.move({
        from: source,
        to: target,
        promotion: promo || 'q'
    });
    
    highlightSquares(source, target, 'user');
    
    if (isCapture) {
        synth.playCapture();
    } else {
        synth.playMove();
    }
    
    currentMoveIndex++;
    updateMoveProgressBar();
    
    if (currentMoveIndex < solutionMoves.length) {
        // Opponent plays next move in solution
        userInteractionBlocked = true;
        statusAlert.text('Correct! Opponent is thinking...');
        setTimeout(makeOpponentMove, 450);
    } else {
        // Entire puzzle solved successfully!
        puzzleSolved();
    }
}

function onSnapEnd() {
    board.position(game.fen());
}

function highlightSquares(from, to, type) {
    $('.square-55d63').removeClass('highlight-move highlight-user highlight-hint');
    const className = type === 'user' ? 'highlight-user' : 'highlight-move';
    $(`.square-${from}`).addClass(className);
    $(`.square-${to}`).addClass(className);
}

function updateMoveProgressBar() {
    if (!currentPuzzle) return;
    
    // Moves progress (user moves solved + opponent starting moves / total)
    const pct = (currentMoveIndex / solutionMoves.length) * 100;
    moveProgressBar.css('height', pct + '%');
}

// Streak Level Calculations
function getMilestoneForStreak(streak) {
    if (streak < 5) return { prev: 0, next: 5, level: 0 };
    if (streak < 12) return { prev: 5, next: 12, level: 1 };
    if (streak < 20) return { prev: 12, next: 20, level: 2 };
    if (streak < 30) return { prev: 20, next: 30, level: 3 };
    
    // Above 30, milestones occur every 10 solves
    const prevBase = Math.floor(streak / 10) * 10;
    return { prev: prevBase, next: prevBase + 10, level: Math.floor(prevBase / 10) + 1 };
}

function updateStreakMeter() {
    const { prev, next, level } = getMilestoneForStreak(currentStreak);
    const range = next - prev;
    const progress = currentStreak - prev;
    const pct = Math.max(0, Math.min(100, (progress / range) * 100));
    
    streakMeterBar.css('width', pct + '%');
    
    // Streak animations and styling
    const badge = $('.streak-badge');
    if (currentStreak >= 5) {
        badge.addClass('on-fire');
    } else {
        badge.removeClass('on-fire');
    }
    
    // Streak feedback texts
    if (currentStreak === 0) {
        streakFeedback.text("Streak is warming up...");
    } else if (currentStreak < 5) {
        streakFeedback.text(`Streak warming up... ${currentStreak}/${next}`);
    } else {
        streakFeedback.text(`Streak Level ${level}! Next bonus at ${next} 🔥`);
    }
}

function puzzleSolved() {
    score++;
    currentStreak++;
    totalSolvedThisRun++;
    totalPuzzlesThisRun++;
    
    scoreDisplay.text(score);
    streakDisplay.text(currentStreak);
    
    if (currentStreak > bestStreak) {
        bestStreak = currentStreak;
    }
    
    statusAlert.text('Puzzle Solved! Great job.').addClass('correct');
    synth.playCorrect();
    
    // Document correct puzzle details
    const puzzleRating = parseInt(currentPuzzle.rating);
    if (puzzleRating > maxRatingSolved) {
        maxRatingSolved = puzzleRating;
    }
    
    playedPuzzles.push({
        puzzle: currentPuzzle,
        correct: true
    });
    
    addHistoryItemToSidebar(currentPuzzle, true);
    
    // Check for Streak Milestone Time Bonuses
    const { next } = getMilestoneForStreak(currentStreak - 1);
    if (currentStreak === next) {
        secondsRemaining += 5; // Add 5 seconds
        synth.playMilestone();
        
        // Show floating message text on screen
        showStreakBonusFloatingAlert(`+5s Streak Bonus!`);
        updateTimerUI();
    }
    
    updateStreakMeter();
    
    // Increase target rating difficulty
    baseTargetRating = Math.min(3000, baseTargetRating + 40);
    
    userInteractionBlocked = true;
    setTimeout(loadNextPuzzleFromQueue, 350);
}

function addHistoryItemToSidebar(puzzle, correct) {
    const statusIcon = correct ? '✓' : '✗';
    const statusClass = correct ? 'correct' : 'wrong';
    
    const item = $(`
        <div class="history-item ${statusClass}">
            <span class="history-status-icon">${statusIcon}</span>
            <div class="history-info">
                <span class="rating">Rating: ${puzzle.rating}</span>
                <span class="themes">${puzzle.themes.split(' ').slice(0, 2).join(', ')}</span>
            </div>
            <span class="badge">#${puzzle.id}</span>
        </div>
    `);
    
    // Prepend to show newest at the top
    runHistoryList.prepend(item);
    $('#historyCount').text(`${totalSolvedThisRun} solved`);
}

function showStreakBonusFloatingAlert(message) {
    const alertBox = $('<div class="floating-streak-alert">').text(message);
    $('main').append(alertBox);
    
    // Apply styling via CSS dynamically in script to avoid pollution
    alertBox.css({
        position: 'absolute',
        top: '35%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'linear-gradient(135deg, var(--gold), var(--orange))',
        color: '#000',
        padding: '12px 24px',
        borderRadius: '99px',
        fontWeight: '800',
        fontSize: '1.25rem',
        boxShadow: '0 10px 25px rgba(249, 115, 22, 0.4)',
        zIndex: '2000',
        pointerEvents: 'none',
        animation: 'scaleIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
    });
    
    setTimeout(() => {
        alertBox.fadeOut(400, () => alertBox.remove());
    }, 1200);
}

// End Run / Game Over Screen
function endStormRun() {
    clearInterval(gameTimer);
    gameState = 'GAMEOVER';
    synth.playGameOver();
    
    // Confetti!
    if (score > 0) {
        confetti({
            particleCount: 150,
            spread: 90,
            origin: { y: 0.6 }
        });
    }
    
    // Personal best calculations
    const oldPB = parseInt(localStorage.getItem(PB_KEY)) || 0;
    let isNewPB = false;
    if (score > oldPB) {
        localStorage.setItem(PB_KEY, score);
        isNewPB = true;
    }
    
    // Stats calculation
    const totalPlayed = playedPuzzles.length;
    const accuracy = totalPlayed > 0 ? Math.round((totalSolvedThisRun / totalPlayed) * 100) : 0;
    
    // Increment global games played
    const globalCount = parseInt(localStorage.getItem(TOTAL_PLAYED_KEY)) || 0;
    localStorage.setItem(TOTAL_PLAYED_KEY, globalCount + 1);
    
    if (typeof ChessAccounts !== 'undefined' && ChessAccounts.isLoggedIn()) {
        ChessAccounts.syncCurrentLocalStats().catch(err => console.error("Failed to sync stats to worker:", err));
    }
    
    // Update Lobby displays
    loadLobbyStats();
    
    // Populate Results Overlay Card
    $('#finalScore').text(score);
    $('#resultBestStreak').text(bestStreak);
    $('#resultAccuracy').text(accuracy + '%');
    $('#resultTotalPlayed').text(totalPlayed);
    $('#resultMaxRating').text(maxRatingSolved > 0 ? maxRatingSolved : '----');
    
    if (isNewPB && score > 0) {
        $('#newHighScoreLabel').removeClass('hidden');
    } else {
        $('#newHighScoreLabel').addClass('hidden');
    }
    
    // Reset review container
    $('#mistakesReviewSection').addClass('hidden');
    
    // Configure Review Mistakes button
    const mistakes = playedPuzzles.filter(p => !p.correct);
    if (mistakes.length > 0) {
        $('#reviewBtn').show();
        setupReviewMistakesList(mistakes);
    } else {
        $('#reviewBtn').hide();
    }
    
    // Display results screen overlay
    gameOverOverlay.removeClass('hidden');
}

function resetAndStartNewStorm() {
    gameOverOverlay.addClass('hidden');
    
    // Reset target rating
    baseTargetRating = 600;
    
    // Empty the queue so we load fresh rating puzzles
    puzzleQueue.length = 0;
    fillQueue();
    
    startCountdown();
}

function abortRun() {
    if (confirm("Are you sure you want to abort this storm run?")) {
        clearInterval(gameTimer);
        gameState = 'LOBBY';
        startOverlay.removeClass('hidden');
        gameOverOverlay.addClass('hidden');
        if (board) board.destroy();
        board = null;
        updateLobbyStartButton();
    }
}

// Mistakes Practice & Review Mode
function setupReviewMistakesList(mistakes) {
    const list = $('#mistakesList');
    list.empty();
    
    mistakes.forEach((item, index) => {
        const tile = $(`
            <div class="review-tile pending" data-index="${index}">
                <span class="num">Puzzle ${index + 1}</span>
                <span class="rating">${item.puzzle.rating}</span>
                <span class="status">Retry</span>
            </div>
        `);
        
        tile.click(() => startReviewingPuzzle(index, mistakes));
        list.append(tile);
    });
    
    // Clear review buttons event handlers to avoid duplication
    $('#reviewBtn').off('click').click(() => {
        $('#mistakesReviewSection').removeClass('hidden');
        startReviewingPuzzle(0, mistakes);
    });
    
    $('#exitReviewBtn').off('click').click(() => {
        reviewMode = false;
        gameOverOverlay.removeClass('hidden');
        $('#mistakesReviewSection').addClass('hidden');
        if (board) board.destroy();
        board = null;
    });
}

function startReviewingPuzzle(idx, mistakes) {
    if (idx < 0 || idx >= mistakes.length) return;
    
    reviewMode = true;
    reviewIndex = idx;
    
    // UI active classes
    $('.review-tile').removeClass('active');
    $(`.review-tile[data-index="${idx}"]`).addClass('active');
    
    const item = mistakes[idx];
    currentPuzzle = item.puzzle;
    solutionMoves = currentPuzzle.moves;
    currentMoveIndex = 0;
    userInteractionBlocked = false;
    
    $('#reviewStatus').text(`Reviewing Puzzle #${idx + 1} (Rating: ${currentPuzzle.rating})`);
    statusAlert.text('Try to find the correct moves!').removeClass('correct wrong');
    
    updateMoveProgressBar();
    
    // Set up board for review
    game.load(currentPuzzle.fen);
    
    const userColor = game.turn() === 'w' ? 'black' : 'white';
    
    const config = {
        draggable: true,
        position: currentPuzzle.fen,
        orientation: userColor,
        pieceTheme: '../puzzlenormal/img/chesspieces/wikipedia/{piece}.png',
        onDragStart: onDragStart,
        onDrop: onDrop,
        onSnapEnd: onSnapEnd
    };
    
    if (board) board.destroy();
    board = Chessboard('myBoard', config);
    
    // Set user's turn direction text immediately
    statusAlert.text(userColor === 'white' ? 'White to move' : 'Black to move').removeClass('correct wrong');
    
    // Opponent makes their move in review
    userInteractionBlocked = true;
    setTimeout(makeOpponentMove, 500);
    
    // Connect Review Controls Buttons
    $('#reviewHintBtn').off('click').click(() => {
        if (currentMoveIndex >= solutionMoves.length) return;
        const hintSq = solutionMoves[currentMoveIndex].substring(0, 2);
        
        $('.square-55d63').removeClass('highlight-hint');
        $(`.square-${hintSq}`).addClass('highlight-hint');
        statusAlert.text(`Hint: Start by moving the piece on ${hintSq}.`);
        
        setTimeout(() => {
            $(`.square-${hintSq}`).removeClass('highlight-hint');
        }, 1500);
    });
    
    $('#reviewSolveBtn').off('click').click(() => {
        userInteractionBlocked = true;
        game.load(currentPuzzle.fen);
        board.position(currentPuzzle.fen);
        currentMoveIndex = 0;
        
        let moveIdx = 0;
        const showSequence = setInterval(() => {
            if (moveIdx >= solutionMoves.length) {
                clearInterval(showSequence);
                statusAlert.text("Solution sequence completed.");
                markReviewPuzzleStatus(idx, 'failed', mistakes);
                return;
            }
            
            const moveStr = solutionMoves[moveIdx];
            const fromSq = moveStr.substring(0, 2);
            const toSq = moveStr.substring(2, 4);
            const promo = moveStr.length > 4 ? moveStr.substring(4, 5) : null;
            
            game.move({
                from: fromSq,
                to: toSq,
                promotion: promo || 'q'
            });
            
            board.position(game.fen());
            highlightSquares(fromSq, toSq, moveIdx % 2 === 0 ? 'move' : 'user');
            synth.playMove();
            
            moveIdx++;
            currentMoveIndex = moveIdx;
            updateMoveProgressBar();
        }, 850);
    });
}

function markReviewPuzzleStatus(idx, status, mistakes) {
    const tile = $(`.review-tile[data-index="${idx}"]`);
    tile.removeClass('pending solved failed');
    
    if (status === 'solved') {
        tile.addClass('solved').find('.status').text('Solved');
    } else {
        tile.addClass('failed').find('.status').text('Revealed');
    }
    
    // Auto advance to next mistake after a small delay if solved
    if (status === 'solved' && idx + 1 < mistakes.length) {
        setTimeout(() => {
            startReviewingPuzzle(idx + 1, mistakes);
        }, 1500);
    }
}

// Review complete puzzle solve trigger
function reviewPuzzleSolved() {
    synth.playCorrect();
    statusAlert.text("Solved correctly!").addClass('correct');
    
    const tile = $(`.review-tile[data-index="${reviewIndex}"]`);
    tile.removeClass('pending').addClass('solved').find('.status').text('Solved');
    
    // Trigger small confetti burst
    confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 }
    });
    
    // Auto load next mistake after 1.5s
    const tileParent = $('#mistakesList');
    const nextTile = $(`.review-tile[data-index="${reviewIndex + 1}"]`);
    
    if (nextTile.length > 0) {
        setTimeout(() => {
            nextTile.click();
            // Scroll tiles list if overflowed
            tileParent.animate({
                scrollLeft: nextTile.position().left + tileParent.scrollLeft() - 40
            }, 300);
        }, 1500);
    } else {
        statusAlert.text("All review puzzles finished! Well done.");
    }
}

// Override puzzleSolved for Review Mode compatibility
const originalPuzzleSolved = puzzleSolved;
puzzleSolved = function() {
    if (reviewMode) {
        reviewPuzzleSolved();
    } else {
        originalPuzzleSolved();
    }
};

// Handle window resize for chessboard responsiveness
$(window).resize(() => {
    if (board) board.resize();
});
