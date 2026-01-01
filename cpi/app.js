/* Chess PGN Importer - No external libraries
   Features:
   - Load .pgn file or paste PGN text
   - Parse multiple games, select one
   - Render board and step through SAN moves
   - Auto-play, reset, download selected PGN
*/

(() => {
  // UI elements
  const pgnFile = document.getElementById('pgnFile');
  const demoBtn = document.getElementById('demoBtn');
  const clearBtn = document.getElementById('clearBtn');
  const importBtn = document.getElementById('importBtn');
  const pgnText = document.getElementById('pgnText');
  const statusEl = document.getElementById('status');
  const gameSelect = document.getElementById('gameSelect');
  const boardEl = document.getElementById('board');
  const resetBtn = document.getElementById('resetBtn');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const playBtn = document.getElementById('playBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const moveListEl = document.getElementById('moveList');
  const plyInfo = document.getElementById('plyInfo');
  const turnInfo = document.getElementById('turnInfo');
  const resultInfo = document.getElementById('resultInfo');

  // State
  let games = [];
  let currentGame = null;
  let board = null;
  let history = [];
  let plyIndex = 0;
  let autoplayTimer = null;

  const FILES = ['a','b','c','d','e','f','g','h'];

  function createBoard() {
    const b = Array.from({ length: 8 }, () => Array(8).fill(null));
    const backRank = ['R','N','B','Q','K','B','N','R'];
    b[0] = backRank.map(p => p.toLowerCase());
    b[1] = Array(8).fill('p');
    b[6] = Array(8).fill('P');
    b[7] = backRank.map(p => p);
    return b;
  }

  function renderBoard() {
    boardEl.innerHTML = '';
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const sq = document.createElement('div');
        sq.className = 'square ' + (((r + f) % 2 === 0) ? 'light' : 'dark');
        const piece = board[r][f];
        sq.textContent = pieceToEmoji(piece);
        sq.setAttribute('data-square', `${FILES[f]}${8 - r}`);
        boardEl.appendChild(sq);
      }
    }
    highlightCurrentSquares();
  }

  function pieceToEmoji(p) {
    if (!p) return '';
    const map = {
      'K': '♔','Q': '♕','R': '♖','B': '♗','N': '♘','P': '♙',
      'k': '♚','q': '♛','r': '♜','b': '♝','n': '♞','p': '♟︎'
    };
    return map[p] || '';
  }

  function squareToRC(sq) {
    const file = FILES.indexOf(sq[0]);
    const rank = 8 - parseInt(sq[1], 10);
    return { r: rank, f: file };
  }

  function rcToSquare(r, f) {
    return `${FILES[f]}${8 - r}`;
  }

  // --- PGN parsing ---
  function parsePGN(text) {
    const cleaned = text.replace(/\r\n/g, '\n').trim();
    // Split by blank lines between games OR by tags start
    const chunks = cleaned
      .split(/\n(?=

\[Event\s)|\n{2,}/)   // regex properly closed
      .filter(s => s.trim());
    const out = [];
    for (let chunk of chunks) {
      const { tags, movetext } = extractTagsAndMovetext(chunk);
      const { moves, result } = parseMovetext(movetext);
      if (moves.length) {
        out.push({
          tags,
          moves,
          result: result || tags.Result || '—',
          raw: chunk.trim()
        });
      }
    }
    return out;
  }

  function extractTagsAndMovetext(chunk) {
    const tags = {};
    const lines = chunk.split('\n');
    let i = 0;
    while (i < lines.length && lines[i].startsWith('[')) {
      const m = lines[i].match(/^

\[(\w+)\s+"(.*)"\]

$/);
      if (m) tags[m[1]] = m[2];
      i++;
    }
    const movetext = lines.slice(i).join(' ');
    return { tags, movetext };
  }

  function parseMovetext(mtext) {
    // Remove comments {...}, NAGs $x, and variations (...) for simplicity
    let s = mtext
      .replace(/\{[^}]*\}/g, ' ')
      .replace(/\$[0-9]+/g, ' ')
      .replace(/\([^)]*\)/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Extract result token
    let result = null;
    const resMatch = s.match(/\s(1-0|0-1|1\/2-1\/2|\*)\s?$/);
    if (resMatch) {
      result = resMatch[1];
      s = s.replace(/\s(1-0|0-1|1\/2-1\/2|\*)\s?$/, ' ').trim();
    }

    // Remove move numbers like "12." or "12..."
    s = s.replace(/\b\d+\.(\.\.)?/g, ' ').replace(/\s+/g, ' ').trim();
    const toks = s.split(' ').filter(Boolean);

    return { moves: toks, result };
  }

  // --- Setup and controls ---
  function setupFromStart() {
    board = createBoard();
    history = [];
    plyIndex = 0;
    renderBoard();
    updateInfo();
    renderMoveList();
  }

  function applyNext() {
    if (!currentGame) return;
    if (plyIndex >= currentGame.moves.length) return;
    const san = currentGame.moves[plyIndex];
    plyIndex++;
    history.push(san);
    renderBoard();
    updateInfo();
    renderMoveList();
  }

  function applyPrev() {
    if (plyIndex <= 0) return;
    const target = plyIndex - 1;
    setupFromStart();
    for (let i = 0; i < target; i++) applyNext();
  }

  function updateInfo() {
    plyInfo.textContent = `${plyIndex} / ${currentGame ? currentGame.moves.length : 0}`;
    turnInfo.textContent = (plyIndex % 2 === 0) ? 'White' : 'Black';
    resultInfo.textContent = currentGame ? currentGame.result : '—';
  }

  function renderMoveList() {
    moveListEl.innerHTML = '';
    if (!currentGame) return;
    const wrapper = document.createElement('div');
    let out = '';
    for (let i = 0; i < currentGame.moves.length; i += 2) {
      const w = currentGame.moves[i] || '';
      const b = currentGame.moves[i + 1] || '';
      const turnNum = (i / 2) + 1;
      out += `<span class="ply ${i === plyIndex ? 'active' : ''}">${turnNum}. ${w}</span> `;
      if (b) out += `<span class="ply ${i + 1 === plyIndex ? 'active' : ''}">${b}</span> `;
    }
    wrapper.innerHTML = out;
    moveListEl.appendChild(wrapper);
  }

  function highlightCurrentSquares() {
    [...boardEl.querySelectorAll('.square')].forEach(s => s.classList.remove('highlight'));
    if (!currentGame || plyIndex <= 0) return;
    const prevSAN = currentGame.moves[plyIndex - 1];
    const toMatch = prevSAN.match(/([a-h][1-8])$/);
    const toSq = toMatch ? toMatch[1] : null;
    if (toSq) {
      const el = boardEl.querySelector(`.square[data-square="${toSq}"]`);
      if (el) el.classList.add('highlight');
    }
  }

  // --- Event wiring ---
  pgnFile.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    pgnText.value = text;
    statusEl.textContent = `Loaded file: ${file.name}`;
  });

  clearBtn.addEventListener('click', () => {
    pgnText.value = '';
    gameSelect.innerHTML = '';
    currentGame = null;
    setupFromStart();
  });

  demoBtn.addEventListener('click', () => {
    const demo = `
[Event "Demo"]
[Site "Internet"]
[Date "2026.01.01"]
[Round "1"]
[White "White"]
[Black "Black"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7
6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8 10. d4 Nbd7
11. Nbd2 Bb7 12. Bc2 Re8 13. Nf1 Bf8 14. Ng3 g6 15. Bg5 h6
16. Be3 Bg7 17. Qd2 Kh7 18. a4 c5 19. d5 c4 20. Nh2 Nc5
21. Ng4 Nxg4 22. hxg4 Qh4 23. Qe2 Nd7 24. Nf1 Nf6 25. f3 Nd7
26. g3 Qe7 27. Qh2 Rh8 28. Kg2 Kg8 29. Nd2 Nf8 30. Rh1 g5
31. Qg1 Ng6 32. Qf2 Qd7 33. Rh5 Nf8 34. Rah1 Bc8 35. Bxg5 f6
36. Bxh6 Rxh6 37. Rxh6 Rxh6 38. Rxh6 Bxh6 39. Nf1 Qh7 40. Ne3 Qg7
41. Nf5 Bxf5 42. exf5 Qg5 43. axb5 axb5 44. Qb6 Qd2+ 45. Qf2 Qc1
46. Qe2 Qxb2 47. f4 exf4 48. gxf4 Qxc3 49. g5 fxg5 50. fxg5 Bxg5
51. Qg4 Nh7 52. Qe4 Qe5 53. Qxe5 dxe5 54. Kf3 Nf6 55. d6 Kf7
56. Be4 Nxe4 57. Kxe4 Ke8 58. Kxe5 c3 59. d7+ Kxd7 60. f6 Bxf6+
61. Kxf6 c2 62. Ke5 c1=Q 63. Ke4 Qc5 64. Kf4 b4 65. Ke4 b3 66. Kd3 b2
67. Kd2 b1=Q 68. Ke2 Qbc2+ 69. Kf3 Qd4 70. Kg3 Qcf2+ 71. Kh3 Qdh4#
1-0
    `.trim();
    pgnText.value = demo;
    statusEl.textContent = 'Loaded demo PGN';
  });

  importBtn.addEventListener('click', () => {
    const text = pgnText.value.trim();
    if (!text) {
      statusEl.textContent = 'Paste PGN or load a file';
      return;
    }
    games = parsePGN(text);
    gameSelect.innerHTML = '';
    if (!games.length) {
      statusEl.textContent = 'No games parsed';
      return;
    }
    games.forEach((g, i) => {
      const opt = document.createElement('option');
      const white = g.tags.White || 'White';
      const black = g.tags.Black || 'Black';
      const event = g.tags.Event || 'Event';
      const res = g.result || '—';
      opt.value = i;
      opt.textContent = `${i + 1}. ${white} vs ${black} • ${event} • ${res}`;
      gameSelect.appendChild(opt);
    });
    gameSelect.selectedIndex = 0;
    selectGame(0);
    statusEl.textContent = `Imported ${games.length} game(s)`;
  });

  gameSelect.addEventListener('change', (e) => {
    const idx = Number(e.target.value);
    selectGame(idx);
  });

  function selectGame(idx) {
    currentGame = games[idx];
    setupFromStart();
  }

  resetBtn.addEventListener('click', () => {
    setupFromStart();
  });

  prevBtn.addEventListener('click', () => {
    stopPlay();
    applyPrev();
  });

  nextBtn.addEventListener('click', () => {
    stopPlay();
    applyNext();
  });

  playBtn.addEventListener('click', () => {
    if (autoplayTimer) {
      stopPlay();
      return;
    }
    playBtn.textContent = '⏸ Pause';
    autoplayTimer = setInterval(() => {
      if (!currentGame || plyIndex >= currentGame.moves.length) {
        stopPlay();
        return;
      }
      applyNext();
    }, 800);
  });

  function stopPlay() {
    if (autoplayTimer) {
      clearInterval(autoplayTimer);
      autoplayTimer = null;
    }
    playBtn.textContent = '▶ Play';
  }

  downloadBtn.addEventListener('click', () => {
    if (!currentGame) return;
    const blob = new Blob([currentGame.raw], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const name = `${currentGame.tags.White || 'White'}-vs-${currentGame.tags.Black || 'Black'}.pgn`.replace(/\s+/g, '_');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  // Init
  setupFromStart();
})();
