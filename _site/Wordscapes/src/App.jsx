import React, { useEffect, useRef, useState } from 'react';

// ── SOUND ENGINE ────────────────────────────────────────────────
const audioCtx = typeof window !== 'undefined' ? new (window.AudioContext || window.webkitAudioContext)() : null;

function playTone(freq, type = 'sine', duration = 0.12, vol = 0.18, delay = 0) {
  if (!audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime + delay);
    gain.gain.setValueAtTime(0, audioCtx.currentTime + delay);
    gain.gain.linearRampToValueAtTime(vol, audioCtx.currentTime + delay + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + delay + duration);
    osc.start(audioCtx.currentTime + delay);
    osc.stop(audioCtx.currentTime + delay + duration + 0.02);
  } catch (_) {}
}

function playCorrect() {
  playTone(523, 'sine', 0.1, 0.15);
  playTone(659, 'sine', 0.1, 0.15, 0.1);
  playTone(784, 'sine', 0.15, 0.15, 0.2);
}

function playBonus() {
  [523, 659, 784, 1047].forEach((f, i) => playTone(f, 'triangle', 0.1, 0.12, i * 0.08));
}

function playError() {
  playTone(220, 'sawtooth', 0.15, 0.12);
  playTone(180, 'sawtooth', 0.15, 0.1, 0.1);
}

function playSelect() {
  playTone(660, 'sine', 0.05, 0.08);
}

function playComplete() {
  [523, 659, 784, 1047, 1319].forEach((f, i) => playTone(f, 'triangle', 0.18, 0.15, i * 0.07));
}

// ── LETTER WHEEL ────────────────────────────────────────────────
function LetterWheel({ letters, onWordSubmit, onCurrentGuessChange }) {
  const [selectedIndices, setSelectedIndices] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);

  const radius = 100;
  const cx = 140, cy = 140;

  const getLetterPos = (index) => {
    const angle = (index / letters.length) * 2 * Math.PI - Math.PI / 2;
    return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
  };

  const getIndexFromPoint = (clientX, clientY) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return -1;
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    for (let i = 0; i < letters.length; i++) {
      const pos = getLetterPos(i);
      const dist = Math.hypot(px - pos.x, py - pos.y);
      if (dist < 26) return i;
    }
    return -1;
  };

  const startSelect = (idx) => {
    if (idx < 0) return;
    playSelect();
    setIsDragging(true);
    setSelectedIndices([idx]);
  };

  const continueSelect = (clientX, clientY) => {
    if (!isDragging) return;
    const idx = getIndexFromPoint(clientX, clientY);
    if (idx >= 0 && !selectedIndices.includes(idx)) {
      playSelect();
      setSelectedIndices(prev => [...prev, idx]);
    }
  };

  const endSelect = () => {
    if (!isDragging) return;
    if (selectedIndices.length > 0) {
      const word = selectedIndices.map(i => letters[i]).join('');
      onWordSubmit(word);
    }
    setSelectedIndices([]);
    setIsDragging(false);
  };

  useEffect(() => {
    const word = selectedIndices.map(i => letters[i]).join('');
    onCurrentGuessChange(word);
  }, [selectedIndices]);

  // Mouse events
  const onMouseMove = (e) => continueSelect(e.clientX, e.clientY);
  const onMouseUp = () => endSelect();

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging, selectedIndices, letters]);

  // Touch events
  const onTouchMove = (e) => {
    e.preventDefault();
    const t = e.touches[0];
    continueSelect(t.clientX, t.clientY);
  };
  const onTouchEnd = (e) => {
    e.preventDefault();
    endSelect();
  };

  return (
    <div className="wheel-outer-container" ref={containerRef}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{ touchAction: 'none' }}
    >
      <div className="wheel-backdrop" />
      <div className="wheel-center-dot" />
      <div className="wheel-container">
        <svg className="selection-svg" viewBox="0 0 280 280">
          {selectedIndices.map((index, i) => {
            if (i === 0) return null;
            const p1 = getLetterPos(selectedIndices[i - 1]);
            const p2 = getLetterPos(index);
            return (
              <line key={i}
                x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                stroke="rgba(108,99,255,0.7)"
                strokeWidth="6" strokeLinecap="round"
              />
            );
          })}
        </svg>

        {letters.map((letter, index) => {
          const pos = getLetterPos(index);
          const isSelected = selectedIndices.includes(index);
          return (
            <div
              key={index}
              className={`letter-node ${isSelected ? 'selected' : ''}`}
              style={{ left: pos.x, top: pos.y }}
              onMouseDown={() => startSelect(index)}
              onTouchStart={(e) => { e.preventDefault(); startSelect(index); }}
            >
              {letter}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── CROSSWORD GRID ───────────────────────────────────────────────
function CrosswordGrid({ words, gridSize, guessedWords, hintCells, newlyRevealedWord }) {
  if (!gridSize || !words) return null;
  const { rows, cols } = gridSize;

  const gridMap = Array.from({ length: rows }, () => Array(cols).fill(null));

  words.forEach(({ word, x, y, direction }) => {
    const isGuessed = guessedWords.includes(word);
    const isNew = newlyRevealedWord === word;
    for (let i = 0; i < word.length; i++) {
      const curX = direction === 'H' ? x + i : x;
      const curY = direction === 'V' ? y + i : y;
      const key = `${curX},${curY}`;
      const isHint = hintCells.has(key);
      const existing = gridMap[curY][curX];
      gridMap[curY][curX] = {
        char: word[i],
        revealed: isGuessed || (existing && existing.revealed),
        isNew: isNew || (existing && existing.isNew),
        isHint: isHint || (existing && existing.isHint),
      };
    }
  });

  return (
    <div className="grid-wrapper">
      <div
        className="grid-container"
        style={{
          gridTemplateRows: `repeat(${rows}, 1fr)`,
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
        }}
      >
        {gridMap.map((row, y) =>
          row.map((cell, x) => {
            let cls = 'grid-cell';
            if (!cell) cls += ' empty';
            else {
              cls += ' active';
              if (cell.revealed) cls += ' revealed';
              if (cell.isNew) cls += ' just-revealed';
              if (cell.isHint && !cell.revealed) cls += ' hint-revealed';
            }
            return (
              <div key={`${x}-${y}`} className={cls}>
                {cell && (cell.revealed || cell.isHint) ? cell.char : ''}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── CONFETTI ─────────────────────────────────────────────────────
function Confetti() {
  const colors = ['#6c63ff','#a78bfa','#fbbf24','#34d399','#22d3ee','#f472b6'];
  const pieces = Array.from({ length: 60 }, (_, i) => ({
    id: i,
    color: colors[i % colors.length],
    left: Math.random() * 100,
    delay: Math.random() * 1.2,
    duration: 2 + Math.random() * 2,
    size: 6 + Math.random() * 8,
  }));

  return (
    <div className="confetti-container">
      {pieces.map(p => (
        <div key={p.id} className="confetti-piece" style={{
          left: `${p.left}%`,
          background: p.color,
          width: p.size, height: p.size,
          animationDuration: `${p.duration}s`,
          animationDelay: `${p.delay}s`,
          borderRadius: Math.random() > 0.5 ? '50%' : '2px',
        }} />
      ))}
    </div>
  );
}

// ── SCORE FLOAT ───────────────────────────────────────────────────
function ScoreFloat({ value, x, y }) {
  return (
    <div style={{
      position: 'fixed',
      left: x, top: y,
      color: '#fbbf24',
      fontWeight: 900,
      fontSize: '1.4rem',
      fontFamily: "'Space Mono', monospace",
      pointerEvents: 'none',
      zIndex: 200,
      animation: 'scoreFloat 1s ease forwards',
      textShadow: '0 0 12px rgba(251,191,36,0.8)',
      whiteSpace: 'nowrap',
    }}>
      +{value}
    </div>
  );
}

// ── LEVEL COMPLETE MODAL ──────────────────────────────────────────
function LevelCompleteModal({ score, bonusWords, timeLeft, hintsUsed, onNext, puzzleWords }) {
  const [meanings, setMeanings] = useState({});
  const [loadingMeanings, setLoadingMeanings] = useState(true);

  useEffect(() => {
    const fetchMeanings = async () => {
      const results = {};
      for (const { word } of puzzleWords) {
        try {
          const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word.toLowerCase()}`);
          if (res.ok) {
            const data = await res.json();
            const firstMeaning = data[0]?.meanings[0]?.definitions[0]?.definition;
            if (firstMeaning) {
              results[word] = firstMeaning;
            }
          }
        } catch (e) {
          // ignore
        }
      }
      setMeanings(results);
      setLoadingMeanings(false);
    };
    fetchMeanings();
  }, [puzzleWords]);

  const timeBonus = timeLeft * 5;
  const total = score + timeBonus;
  return (
    <>
      <Confetti />
      <div className="modal-overlay" style={{ overflowY: 'auto' }}>
        <div className="modal" style={{ maxHeight: '90vh', overflowY: 'auto', padding: '2rem' }}>
          <span className="modal-emoji">🏆</span>
          <div className="modal-title">Level Complete!</div>
          <div className="modal-sub">You found all the words!</div>
          <div className="modal-stats">
            <div className="modal-stat">
              <span className="modal-stat-val">{total.toLocaleString()}</span>
              <span className="modal-stat-lbl">Final Score</span>
            </div>
            <div className="modal-stat">
              <span className="modal-stat-val">{bonusWords}</span>
              <span className="modal-stat-lbl">Alternatives</span>
            </div>
            <div className="modal-stat">
              <span className="modal-stat-val">{hintsUsed}</span>
              <span className="modal-stat-lbl">Hints Used</span>
            </div>
          </div>
          {timeLeft > 0 && (
            <div style={{ marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--cyan)' }}>
              ⚡ Time bonus: +{timeBonus} pts
            </div>
          )}

          <div style={{ textAlign: 'left', marginTop: '1.5rem', marginBottom: '1.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '1rem' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
              Word Meanings
            </div>
            {loadingMeanings ? (
              <div style={{ fontSize: '0.9rem', color: 'var(--muted)', textAlign: 'center', padding: '1rem' }}>Loading definitions...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {puzzleWords.map(({ word }) => (
                  <div key={word} style={{ fontSize: '0.9rem' }}>
                    <span style={{ fontWeight: 700, color: 'var(--accent2)', marginRight: '8px' }}>{word}</span>
                    <span style={{ color: 'var(--text)', opacity: 0.9 }}>{meanings[word] || 'Definition not found.'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button className="modal-next-btn" onClick={onNext}>
            Next Puzzle →
          </button>
        </div>
      </div>
    </>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────
const TIMER_SECONDS = 180;
const MAX_HINTS = 3;
const SCORE_PER_LETTER = 10;
const COMBO_BONUS = 1.5;

export default function App() {
  const [puzzle, setPuzzle] = useState(null);
  const [guessedWords, setGuessedWords] = useState([]);
  const [bonusWords, setBonusWords] = useState([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [loading, setLoading] = useState(true);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
  const [timerActive, setTimerActive] = useState(false);
  const [hintsLeft, setHintsLeft] = useState(MAX_HINTS);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [hintCells, setHintCells] = useState(new Set());
  const [newlyRevealedWord, setNewlyRevealedWord] = useState(null);
  const [levelComplete, setLevelComplete] = useState(false);
  const [levelNum, setLevelNum] = useState(1);
  const [scoreFloats, setScoreFloats] = useState([]);
  const [validating, setValidating] = useState(false);
  // Cache of checked words so we don't re-hit the API
  const dictCache = useRef({});

  const msgTimer = useRef(null);

  // ── Timer ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!timerActive || timeLeft <= 0) return;
    const id = setInterval(() => setTimeLeft(t => {
      if (t <= 1) { clearInterval(id); setTimerActive(false); return 0; }
      return t - 1;
    }), 1000);
    return () => clearInterval(id);
  }, [timerActive, timeLeft]);

  // ── Fetch puzzle ───────────────────────────────────────────────
  const fetchPuzzle = async () => {
    setLoading(true);
    setLevelComplete(false);
    setPuzzle(null);
    setGuessedWords([]);
    setBonusWords([]);
    setCurrentGuess('');
    setMessage('');
    setScore(0);
    setCombo(0);
    setTimeLeft(TIMER_SECONDS);
    setHintsLeft(MAX_HINTS);
    setHintsUsed(0);
    setHintCells(new Set());
    setNewlyRevealedWord(null);
    setScoreFloats([]);
    try {
      const res = await fetch('https://wordscapes-backend.b4rjxr9lk.workers.dev/api/puzzle');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPuzzle(data);
      setTimerActive(true);
    } catch (err) {
      setMessage(`Error: ${err.message}`);
      setMessageType('error');
    }
    setLoading(false);
  };

  useEffect(() => { fetchPuzzle(); }, []);

  // ── Show message ───────────────────────────────────────────────
  const showMsg = (text, type = 'info') => {
    clearTimeout(msgTimer.current);
    setMessage(text);
    setMessageType(type);
    msgTimer.current = setTimeout(() => { setMessage(''); setMessageType(''); }, 2000);
  };

  // ── Score float ────────────────────────────────────────────────
  const addScoreFloat = (pts) => {
    const id = Date.now() + Math.random();
    const x = window.innerWidth / 2 - 30;
    const y = window.innerHeight * 0.38;
    setScoreFloats(prev => [...prev, { id, value: pts, x, y }]);
    setTimeout(() => setScoreFloats(prev => prev.filter(f => f.id !== id)), 1100);
  };

  // ── Dictionary check ───────────────────────────────────────────
  const isRealWord = async (word) => {
    const lower = word.toLowerCase();
    if (dictCache.current[lower] !== undefined) return dictCache.current[lower];
    try {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${lower}`);
      const valid = res.ok;
      dictCache.current[lower] = valid;
      return valid;
    } catch {
      // On network error, allow the word (fail open)
      return true;
    }
  };

  // ── Word submit ────────────────────────────────────────────────
  const handleWordSubmit = async (word) => {
    if (!puzzle || !word || word.length < 2 || validating) return;
    const upper = word.toUpperCase();

    if (guessedWords.includes(upper) || bonusWords.includes(upper)) {
      showMsg('Already found!', 'info');
      playError();
      return;
    }

    const puzzleWord = puzzle.words.find(pw => pw.word === upper);

    if (puzzleWord) {
      // ✅ Correct puzzle word
      const newGuessed = [...guessedWords, upper];
      setGuessedWords(newGuessed);
      setNewlyRevealedWord(upper);
      setTimeout(() => setNewlyRevealedWord(null), 600);

      const newCombo = combo + 1;
      setCombo(newCombo);
      const multiplier = newCombo >= 3 ? COMBO_BONUS : 1;
      const pts = Math.round(upper.length * SCORE_PER_LETTER * multiplier);
      setScore(s => s + pts);
      addScoreFloat(pts);
      playCorrect();

      if (newCombo >= 3) showMsg(`🔥 ${newCombo}x COMBO!`, 'correct');
      else showMsg('✓ ' + upper, 'correct');

      if (newGuessed.length === puzzle.words.length) {
        setTimeout(() => {
          playComplete();
          setTimerActive(false);
          setLevelComplete(true);
        }, 500);
      }
    } else {
      // 🔍 Not a puzzle word — check dictionary
      setValidating(true);
      showMsg('🔍 Checking…', 'info');
      const valid = await isRealWord(upper);
      setValidating(false);

      if (valid) {
        // 🌟 Bonus/alternative word
        const pts = Math.max(5, upper.length * 5); // 5 pts per letter, min 5
        setBonusWords(prev => [upper, ...prev]);
        setScore(s => s + pts);
        addScoreFloat(pts);
        playBonus();
        showMsg(`⭐ Alternative! +${pts}`, 'bonus');
        // Don't break combo for valid bonus words
      } else {
        setCombo(0);
        playError();
        showMsg('Not a word', 'error');
      }
    }
  };

  // ── Hint ──────────────────────────────────────────────────────
  const useHint = () => {
    if (!puzzle || hintsLeft <= 0) return;
    const unguessed = puzzle.words.filter(pw => !guessedWords.includes(pw.word));
    if (!unguessed.length) return;

    const target = unguessed[0];
    const newHints = new Set(hintCells);

    // Reveal first unrevealed letter
    let revealed = false;
    for (let i = 0; i < target.word.length; i++) {
      const x = target.direction === 'H' ? target.x + i : target.x;
      const y = target.direction === 'V' ? target.y + i : target.y;
      const key = `${x},${y}`;
      if (!newHints.has(key)) {
        newHints.add(key);
        revealed = true;
        break;
      }
    }

    if (revealed) {
      setHintCells(newHints);
      setHintsLeft(h => h - 1);
      setHintsUsed(h => h + 1);
      showMsg('💡 Hint revealed!', 'info');
    }
  };

  // ── Format timer ──────────────────────────────────────────────
  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const progress = puzzle ? (guessedWords.length / puzzle.words.length) * 100 : 0;

  if (loading) return (
    <div className="loading-screen">
      <div className="loading-spinner" />
      <div className="loading-text">Generating your puzzle…</div>
    </div>
  );

  if (!puzzle) return (
    <div className="error-screen">
      <div className="error-icon">⚠️</div>
      <div className="error-msg">{message || 'Failed to load puzzle. Check your connection.'}</div>
      <button className="new-game-btn" onClick={fetchPuzzle}>Try Again</button>
    </div>
  );

  return (
    <div className="app-container">
      {/* Score floats */}
      {scoreFloats.map(f => <ScoreFloat key={f.id} value={f.value} x={f.x} y={f.y} />)}

      {/* Level complete modal */}
      {levelComplete && (
        <LevelCompleteModal
          score={score}
          bonusWords={bonusWords.length}
          timeLeft={timeLeft}
          hintsUsed={hintsUsed}
          puzzleWords={puzzle.words}
          onNext={() => { setLevelNum(n => n + 1); fetchPuzzle(); }}
        />
      )}

      {/* Header */}
      <header>
        <div className="header-left">
          <div className="logo">Wordscapes</div>
          <span className="level-badge">Lvl {levelNum}</span>
        </div>
        <div className="header-right">
          <button className="new-game-btn" onClick={() => { setLevelNum(n => n + 1); fetchPuzzle(); }}>
            New Game
          </button>
        </div>
      </header>

      {/* Stats bar */}
      <div className="stats-bar">
        <div className="stat-item">
          <span className="stat-label">Score</span>
          <span className="stat-value score">{score.toLocaleString()}</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <span className="stat-label">Time</span>
          <span className={`stat-value timer ${timeLeft <= 30 ? 'danger' : ''}`}>
            {formatTime(timeLeft)}
          </span>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <span className="stat-label">Combo</span>
          <span className="stat-value" style={{ color: combo >= 3 ? '#f87171' : 'var(--text)' }}>
            {combo >= 3 ? `🔥${combo}` : combo > 0 ? `×${combo}` : '—'}
          </span>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <span className="stat-label">Seed</span>
          <span className="stat-value" style={{ fontSize: '0.75rem', letterSpacing: '0.05em', color: 'var(--accent2)', fontFamily: "'Space Mono', monospace" }}>
            {puzzle.seedWord}
          </span>
        </div>
      </div>

      {/* Progress */}
      <div className="progress-section">
        <div className="progress-header">
          <span className="progress-label">Words Found</span>
          <span className="progress-count">{guessedWords.length} / {puzzle.words.length}</span>
        </div>
        <div className="progress-bar-track">
          <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Hint button */}
      <div className="hints-row">
        <button className="hint-btn" onClick={useHint} disabled={hintsLeft <= 0 || levelComplete}>
          💡 Hint <span className="hint-count">{hintsLeft}</span>
        </button>
      </div>

      {/* Message */}
      <div className={`message-area ${messageType}`}>{message}</div>

      {/* Grid */}
      <CrosswordGrid
        words={puzzle.words}
        gridSize={puzzle.gridSize}
        guessedWords={guessedWords}
        hintCells={hintCells}
        newlyRevealedWord={newlyRevealedWord}
      />

      {/* Current guess */}
      <div className="guess-display-wrap">
        <div className="guess-display">
          {validating
            ? <span className="guess-placeholder" style={{ color: 'var(--accent2)', animation: 'blink 0.8s ease infinite' }}>🔍 Checking dictionary…</span>
            : currentGuess.length > 0
              ? currentGuess.split('').map((c, i) => (
                  <div key={i} className="guess-letter">{c}</div>
                ))
              : <span className="guess-placeholder">Drag to spell a word</span>
          }
        </div>
      </div>

      {/* Letter wheel */}
      <div style={{ opacity: validating ? 0.5 : 1, pointerEvents: validating ? 'none' : 'auto', transition: 'opacity 0.2s' }}>
        <LetterWheel
          letters={puzzle.letters}
          onWordSubmit={handleWordSubmit}
          onCurrentGuessChange={setCurrentGuess}
        />
      </div>

      {/* Alternatives box */}
      <div className="bonus-section" style={{ opacity: bonusWords.length === 0 ? 0.4 : 1, transition: 'opacity 0.4s' }}>
        <div className="bonus-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>✦ Alternatives Box</span>
          {bonusWords.length > 0 && (
            <span style={{ color: 'var(--cyan)', fontVariantNumeric: 'tabular-nums' }}>
              {bonusWords.length} word{bonusWords.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {bonusWords.length === 0
          ? <p style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.5 }}>
              Spell any real English word not in the puzzle — it lands here and scores points!
            </p>
          : <div className="bonus-chips">
              {bonusWords.map(w => (
                <span key={w} className="bonus-chip">
                  {w}
                  <span style={{ marginLeft: 5, opacity: 0.65, fontSize: 10 }}>+{Math.max(5, w.length * 5)}</span>
                </span>
              ))}
            </div>
        }
      </div>
    </div>
  );
}
