const display = document.getElementById('display');
const historyEl = document.getElementById('history');
const memoryIndicator = document.getElementById('memory-indicator');

let currentInput = '0';
let previousInput = '';
let operation = null;
let shouldResetInput = false;
let memory = 0;
let hasMemory = false;
let expression = '';
let justEvaluated = false;

const MAX_DIGITS = 15;

function updateDisplay() {
  let val = currentInput;
  if (val.length > MAX_DIGITS + 1) {
    val = parseFloat(val).toExponential(6);
  }
  display.textContent = val;
  memoryIndicator.textContent = hasMemory ? 'M' : '';
}

function appendNumber(num) {
  if (shouldResetInput || justEvaluated) {
    currentInput = num;
    shouldResetInput = false;
    justEvaluated = false;
    updateDisplay();
    return;
  }
  if (currentInput === '0' && num !== '.') {
    currentInput = num;
  } else {
    if (currentInput.replace('-', '').replace('.', '').length >= MAX_DIGITS) return;
    currentInput += num;
  }
  updateDisplay();
}

function appendDecimal() {
  if (shouldResetInput || justEvaluated) {
    currentInput = '0.';
    shouldResetInput = false;
    justEvaluated = false;
    updateDisplay();
    return;
  }
  if (!currentInput.includes('.')) {
    currentInput += '.';
  }
  updateDisplay();
}

function chooseOperation(op) {
  justEvaluated = false;
  if (operation && !shouldResetInput) {
    calculate();
  }
  previousInput = currentInput;
  operation = op;
  shouldResetInput = true;
  expression = `${formatNumber(previousInput)} ${getOpSymbol(op)}`;
  historyEl.textContent = expression;
}

function getOpSymbol(op) {
  const map = { add: '+', subtract: '−', multiply: '×', divide: '÷' };
  return map[op] || op;
}

function calculate() {
  if (!operation) return;
  const prev = parseFloat(previousInput);
  const curr = parseFloat(currentInput);
  if (isNaN(prev) || isNaN(curr)) return;

  let result;
  switch (operation) {
    case 'add': result = prev + curr; break;
    case 'subtract': result = prev - curr; break;
    case 'multiply': result = prev * curr; break;
    case 'divide':
      if (curr === 0) {
        currentInput = 'Error';
        operation = null;
        shouldResetInput = true;
        historyEl.textContent = `${formatNumber(prev)} ÷ 0 =`;
        updateDisplay();
        return;
      }
      result = prev / curr;
      break;
    default: return;
  }

  historyEl.textContent = `${formatNumber(prev)} ${getOpSymbol(operation)} ${formatNumber(curr)} =`;
  currentInput = formatResult(result);
  operation = null;
  shouldResetInput = true;
  justEvaluated = true;
  updateDisplay();
}

function formatResult(n) {
  if (!isFinite(n)) return 'Error';
  if (Number.isInteger(n) && Math.abs(n) < 1e15) {
    return String(n);
  }
  const s = parseFloat(n.toFixed(10));
  const str = String(s);
  if (str.length > MAX_DIGITS + 1) {
    return n.toExponential(6);
  }
  return str;
}

function formatNumber(n) {
  const str = String(n);
  if (str.length > 12) return parseFloat(n).toExponential(4);
  return str;
}

function undo() {
  if (currentInput === 'Error') {
    currentInput = '0';
    updateDisplay();
    return;
  }
  if (currentInput.length > 1) {
    currentInput = currentInput.slice(0, -1);
  } else {
    currentInput = '0';
  }
  updateDisplay();
}

function negate() {
  if (currentInput === '0' || currentInput === 'Error') return;
  currentInput = currentInput.startsWith('-') ? currentInput.slice(1) : '-' + currentInput;
  if (justEvaluated) {
    historyEl.textContent = `(${display.textContent})`;
    justEvaluated = false;
  }
  updateDisplay();
}

function allClear() {
  currentInput = '0';
  previousInput = '';
  operation = null;
  shouldResetInput = false;
  justEvaluated = false;
  expression = '';
  historyEl.textContent = '';
  updateDisplay();
}

function clearEntry() {
  currentInput = '0';
  updateDisplay();
}

function memoryStore() { memory = parseFloat(currentInput); hasMemory = true; updateDisplay(); }
function memoryRecall() {
  if (!hasMemory) return;
  currentInput = formatResult(memory);
  shouldResetInput = true;
  updateDisplay();
}
function memoryAdd() { memory += parseFloat(currentInput); hasMemory = true; updateDisplay(); }
function memorySubtract() { memory -= parseFloat(currentInput); hasMemory = true; updateDisplay(); }
function memoryClear() { memory = 0; hasMemory = false; updateDisplay(); }

document.querySelector('.buttons').addEventListener('click', (e) => {
  const btn = e.target.closest('.btn');
  if (!btn) return;

  const action = btn.dataset.action;

  btn.classList.add('active');
  setTimeout(() => btn.classList.remove('active'), 100);

  if (action === 'all-clear') { allClear(); return; }
  if (action === 'clear') { clearEntry(); return; }
  if (action === 'undo') { undo(); return; }
  if (action === 'negate') { negate(); return; }
  if (action === 'decimal') { appendDecimal(); return; }
  if (action === 'equals') { calculate(); return; }
  if (action === 'mc') { memoryClear(); return; }
  if (action === 'mr') { memoryRecall(); return; }
  if (action === 'mplus') { memoryAdd(); return; }
  if (action === 'mminus') { memorySubtract(); return; }

  if (['add', 'subtract', 'multiply', 'divide'].includes(action)) {
    chooseOperation(action);
    return;
  }

  appendNumber(action);
});

document.addEventListener('keydown', (e) => {
  const key = e.key;
  const btn = document.querySelector(`[data-action="${key}"]`);
  if (btn) {
    btn.click();
    return;
  }
  if (key === 'Enter') {
    e.preventDefault();
    document.querySelector('[data-action="equals"]').click();
    return;
  }
  if (key === 'Backspace') {
    e.preventDefault();
    document.querySelector('[data-action="undo"]').click();
    return;
  }
  if (key === 'Escape') {
    document.querySelector('[data-action="all-clear"]').click();
    return;
  }
  if (key === '.') {
    document.querySelector('[data-action="decimal"]').click();
    return;
  }
  if (key === '%') {
    document.querySelector('[data-action="percent"]').click();
    return;
  }
  if (['+', '-', '*', '/'].includes(key)) {
    const map = { '+': 'add', '-': 'subtract', '*': 'multiply', '/': 'divide' };
    const el = document.querySelector(`[data-action="${map[key]}"]`);
    if (el) el.click();
    return;
  }
});

updateDisplay();
