document.addEventListener('DOMContentLoaded', () => {
  const board = document.getElementById('board');
  const attemptsSpan = document.getElementById('attempts');
  const timerSpan = document.getElementById('timer');
  const scoreSpan = document.getElementById('score');
  const difficultySelect = document.getElementById('difficulty');
  const newGameBtn = document.getElementById('new-game');
  const restartBtn = document.getElementById('restart-game');
  const themeToggle = document.getElementById('theme-toggle');

  // Emoji set (enough for hardest level)
  const EMOJIS = [
    '🐶','🐱','🦊','🐸','🐵','🐼','🐰','🦁',
    '🐯','🐨','🐻','🐘','🐒','🐷','🐮','🐵',
    '🐔','🐧','🐦','🐤','🦅','🦆','🦢','🦉',
    '🐍','🐢','🦎','🐙','🦑','🐚','🐌','🦋',
    '🐛','🐜','🐝','🐞','🕷️','🕸️','🦂','💐',
    '🌸','🌹','🌺','🌻','🌼','🌷','🌱','🌲',
    '🌳','🌴','🌵','🌾','🌿','☘️','🍀','🍁',
    '🍂','🍃','🍄','🌰','🍎','🍏','🍊','🍋',
    '🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑'
  ];

  // Game state
  let difficulty = 'medium'; // default
  let attempts = 0;
  let seconds = 0;
  let timerInterval = null;
  let matchedPairs = 0;
  let totalPairs = 0;
  let firstCard = null;
  let secondCard = null;
  let lockBoard = false;
  let score = 0;
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  // Load high scores from localStorage
  function loadHighScore() {
    const saved = localStorage.getItem(`memoryGameHighScore_${difficulty}`);
    return saved ? parseInt(saved, 10) : 0;
  }
  function saveHighScore(val) {
    localStorage.setItem(`memoryGameHighScore_${difficulty}`, val);
  }
  let highScore = loadHighScore();

  // Sound effects
  function playSound(type) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.01);
    switch (type) {
      case 'flip':
        osc.frequency.value = 400;
        gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.1);
        break;
      case 'match':
        osc.frequency.value = 800;
        gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.2);
        break;
      case 'mismatch':
        osc.frequency.value = 200;
        gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.15);
        break;
      case 'win':
        osc.frequency.value = 1000;
        gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
        break;
      default:
        osc.frequency.value = 400;
        gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.1);
    }
    osc.start();
    osc.stop(audioCtx.currentTime + 0.5);
  }

  // Update timer display
  function updateTimer() {
    seconds++;
    const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
    const secs = String(seconds % 60).padStart(2, '0');
    timerSpan.textContent = `${mins}:${secs}`;
  }
  function startTimer() {
    if (!timerInterval) {
      timerInterval = setInterval(updateTimer, 1000);
    }
  }
  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }
  function resetTimer() {
    stopTimer();
    seconds = 0;
    timerSpan.textContent = '00:00';
  }

  // Calculate score
  function calculateScore() {
    const base = Math.max(0, 1000 - attempts * 10 - seconds * 5);
    let multiplier = 1;
    if (difficulty === 'medium') multiplier = 1.5;
    else if (difficulty === 'hard') multiplier = 2;
    return Math.floor(base * multiplier);
  }

  // Update score display
  function updateScore() {
    score = calculateScore();
    scoreSpan.textContent = score;
  }

  // Create a card element
  function createCard(symbol) {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.symbol = symbol;
    card.innerHTML = `
      <div class="card-inner">
        <div class="card-front">${symbol}</div>
        <div class="card-back">❓</div>
      </div>
    `;
    card.addEventListener('click', handleCardClick);
    return card;
  }

  // Shuffle array
  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  // Initialize board based on difficulty
  function initGame() {
    // Clear board
    board.innerHTML = '';
    // Reset state
    attempts = 0;
    matchedPairs = 0;
    firstCard = null;
    secondCard = null;
    lockBoard = false;
    attemptsSpan.textContent = attempts;
    updateScore();
    resetTimer();

    // Determine grid size and number of pairs
    let rowsCols;
    switch (difficulty) {
      case 'easy':
        rowsCols = 4; // 4x4 => 16 cards => 8 pairs
        break;
      case 'medium':
        rowsCols = 6; // 6x6 => 36 cards => 18 pairs
        break;
      case 'hard':
        rowsCols = 8; // 8x8 => 64 cards => 32 pairs
        break;
      default:
        rowsCols = 6;
    }
    totalPairs = (rowsCols * rowsCols) / 2;
    // Pick symbols
    const symbols = EMOJIS.slice(0, totalPairs);
    const duplicated = symbols.concat(symbols);
    const shuffled = shuffle(duplicated);
    // Create cards
    shuffled.forEach(symbol => {
      const card = createCard(symbol);
      board.appendChild(card);
    });
    // Adjust grid-template-columns via CSS already responsive; we can set explicit columns if needed
    board.style.gridTemplateColumns = `repeat(${rowsCols}, 1fr)`;
  }

  // Handle card click
  function handleCardClick(e) {
    if (lockBoard) return;
    const card = e.currentTarget;
    if (card === firstCard) return;
    // Flip card
    card.classList.add('flipped');
    playSound('flip');
    // Start timer on first flip
    if (!firstCard && !secondCard) startTimer();

    if (!firstCard) {
      firstCard = card;
      return;
    }
    secondCard = card;
    attempts++;
    attemptsSpan.textContent = attempts;
    checkMatch();
  }

  // Check if two cards match
  function checkMatch() {
    const isMatch = firstCard.dataset.symbol === secondCard.dataset.symbol;
    if (isMatch) {
      disableCards();
      matchedPairs++;
      playSound('match');
      if (matchedPairs === totalPairs) {
        gameOver();
      }
    } else {
      firstCard.classList.add('mismatch');
      secondCard.classList.add('mismatch');
      unflipCards();
      playSound('mismatch');
    }
  }

  // Disable matched cards (no further interaction)
  function disableCards() {
    firstCard.removeEventListener('click', handleCardClick);
    secondCard.removeEventListener('click', handleCardClick);
    firstCard.classList.add('matched');
    secondCard.classList.add('matched');
    resetBoard();
  }

  // Unflip mismatched cards
  function unflipCards() {
    lockBoard = true;
    setTimeout(() => {
      firstCard.classList.remove('flipped');
      secondCard.classList.remove('flipped');
      firstCard.classList.remove('mismatch');
      secondCard.classList.remove('mismatch');
      resetBoard();
    }, 1000);
}

  // Reset board state (but keep flipped status handled)
  function resetBoard() {
    [firstCard, secondCard] = [null, null];
    lockBoard = false;
  }

  // Game over
  function gameOver() {
    stopTimer();
    updateScore();
    playSound('win');
    // Update high score
    if (score > highScore) {
      highScore = score;
      saveHighScore(highScore);
    }
    // Optional: show a message (could use alert or modal)
    setTimeout(() => {
      alert(`Congratulations! You won!\nAttempts: ${attempts}\nTime: ${timerSpan.textContent}\nScore: ${score}\nHigh Score (${difficulty}): ${highScore}`);
    }, 300);
  }

  // Event listeners
  difficultySelect.addEventListener('change', (e) => {
    difficulty = e.target.value;
    highScore = loadHighScore();
    initGame();
  });
  newGameBtn.addEventListener('click', initGame);
  restartBtn.addEventListener('click', () => {
    // Reset attempts/timer/score but keep difficulty and theme
    attempts = 0;
    matchedPairs = 0;
    seconds = 0;
    attemptsSpan.textContent = attempts;
    timerSpan.textContent = '00:00';
    scoreSpan.textContent = 0;
    firstCard = null;
    secondCard = null;
    lockBoard = false;
    stopTimer();
    // Reset board (reshuffle)
    initGame();
  });
  themeToggle.addEventListener('change', (e) => {
    document.body.classList.toggle('dark', e.target.checked);
  });

  // Initialize
  initGame();
});