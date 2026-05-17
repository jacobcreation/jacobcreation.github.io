const state = {
  home: { score: 0, fouls: 0 },
  away: { score: 0, fouls: 0 },
  period: 1,
  timer: 720,
  running: false,
  interval: null,
};

const PERIOD_LENGTH = 720;
const MAX_PERIOD = 4;

const $ = id => document.getElementById(id);

const homeScoreEl = $('home-score');
const awayScoreEl = $('away-score');
const homeFoulsEl = $('home-fouls');
const awayFoulsEl = $('away-fouls');
const periodDisplay = $('period-display');
const timerDisplay = $('timer-display');
const timerStart = $('timer-start');
const winnerModal = $('winner-modal');
const winnerName = $('winner-name');

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function updateUI() {
  homeScoreEl.textContent = state.home.score;
  awayScoreEl.textContent = state.away.score;
  homeFoulsEl.textContent = state.home.fouls;
  awayFoulsEl.textContent = state.away.fouls;
  periodDisplay.textContent = state.period;
  timerDisplay.textContent = formatTime(state.timer);
}

function addPoints(team, pts) {
  state[team].score += pts;
  updateUI();
}

function addFoul(team) {
  state[team].fouls++;
  updateUI();
}

function changePeriod(delta) {
  state.period = Math.max(1, Math.min(MAX_PERIOD, state.period + delta));
  updateUI();
}

function tick() {
  if (!state.running) return;
  if (state.timer > 0) {
    state.timer--;
    timerDisplay.textContent = formatTime(state.timer);
  }
  if (state.timer === 0) {
    stopTimer();
    checkWinner();
  }
}

function startTimer() {
  if (state.running) return;
  if (state.timer === 0) return;
  state.running = true;
  state.interval = setInterval(tick, 1000);
  timerStart.textContent = 'PAUSE';
  timerStart.classList.add('running');
}

function stopTimer() {
  state.running = false;
  clearInterval(state.interval);
  state.interval = null;
  timerStart.textContent = 'START';
  timerStart.classList.remove('running');
}

function toggleTimer() {
  if (state.running) {
    stopTimer();
  } else {
    startTimer();
  }
}

function resetTimer() {
  stopTimer();
  state.timer = PERIOD_LENGTH;
  timerDisplay.textContent = formatTime(state.timer);
}

function resetGame() {
  stopTimer();
  state.home.score = 0;
  state.home.fouls = 0;
  state.away.score = 0;
  state.away.fouls = 0;
  state.period = 1;
  state.timer = PERIOD_LENGTH;
  updateUI();
  winnerModal.classList.add('hidden');
}

function checkWinner() {
  if (state.home.score === state.away.score) return;
  const name = state.home.score > state.away.score
    ? $('home-name').value
    : $('away-name').value;
  winnerName.textContent = name;
  winnerModal.classList.remove('hidden');
}

document.querySelectorAll('.points-btns .btn').forEach(btn => {
  btn.addEventListener('click', () => {
    addPoints(btn.dataset.team, parseInt(btn.dataset.pts));
  });
});

document.querySelectorAll('.foul-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    addFoul(btn.dataset.team);
  });
});

$('period-up').addEventListener('click', () => changePeriod(1));
$('period-down').addEventListener('click', () => changePeriod(-1));

$('timer-start').addEventListener('click', toggleTimer);
$('timer-reset').addEventListener('click', resetTimer);

$('reset-game').addEventListener('click', resetGame);

$('winner-close').addEventListener('click', () => {
  winnerModal.classList.add('hidden');
});

updateUI();
