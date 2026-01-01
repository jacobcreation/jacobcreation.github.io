/* Chess PGN Importer - No external libraries
   Features:
   - Load .pgn file or paste PGN text
   - Parse multiple games, select one
   - Render board and step through SAN moves
   - Auto-play, reset, download selected PGN
   Notes:
   - Basic SAN parser including captures, promotions, checks, castling
   - Ignores comments {...} and variations (...) gracefully
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
  let games = [];            // [{tags, moves[], result, raw}]
  let currentGame = null;    // same shape
  let board = null;          // Board object
  let history = [];          // Applied moves (for stepping)
  let plyIndex = 0;          // Current ply index
  let autoplayTimer = null;

  // --- Board representation ---
  // Pieces: 'P','N','B','R','Q','K' for white, lowercase for black
  const START_FEN = "startpos";
  const FILES = ['a','b','c','d','e','f','g','h'];

  function createBoard() {
    // 8x8 array [rank][file], rank 0 is 8th rank (top), rank 7 is 1st rank (bottom)
    const b = Array.from({ length: 8 }, () => Array(8).fill(null));
    // Place starting pieces
    const backRank = ['R','N','B','Q','K','B','N','R'];
    b[0] = backRank.map(p => p.toLowerCase());         // black 8th rank
    b[1] = Array(8).fill('p');                         // black pawns
    b[6] = Array(8).fill('P');                         // white pawns
    b[7] = backRank.map(p => p);                       // white 1st rank
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
      'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
      'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟︎'
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
    const chunks = cleaned.split(/\n(?=

\[Event\s)|\n{2,}/).filter(s => s.trim());
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

    // Remove move numbers like "12." or "12..."; keep SAN
    s = s.replace(/\b\d+\.(\.\.)?/g, ' ').replace(/\s+/g, ' ').trim();
    const toks = s.split(' ').filter(Boolean);

    // Moves are alternating: White, Black
    return { moves: toks, result };
  }

  // --- SAN application (simplified but robust enough) ---
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
    const turnWhite = (plyIndex % 2 === 0);
    const ok = applySAN(board, san, turnWhite);
    if (!ok) {
      flashStatus(`Could not apply SAN: ${san}`, true);
    } else {
      history.push(san);
      plyIndex++;
      renderBoard();
      updateInfo();
      renderMoveList();
    }
  }

  function applyPrev() {
    if (plyIndex <= 0) return;
    // Rebuild from scratch up to plyIndex-1 for simplicity
    const target = plyIndex - 1;
    setupFromStart();
    for (let i = 0; i < target; i++) {
      applyNext();
    }
  }

  function updateInfo() {
    plyInfo.textContent = `${plyIndex} / ${currentGame ? currentGame.moves.length : 0}`;
    turnInfo.textContent = (plyIndex % 2 === 0) ? 'White' : 'Black';
    resultInfo.textContent = currentGame ? currentGame.result : '—';
  }

  function renderMoveList() {
    moveListEl.innerHTML = '';
    if (!currentGame) return;
    // Display as 1. e4 e5 2. Nf3 Nc6 ...
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

  // --- Simplified SAN logic ---
  function applySAN(b, san, whiteToMove) {
    // Handle castling
    if (/^O-O-O$|^0-0-0$/.test(san)) {
      return castle(b, whiteToMove, true);
    }
    if (/^O-O$|^0-0$/.test(san)) {
      return castle(b, whiteToMove, false);
    }

    // Strip check/mate symbols, annotations
    san = san.replace(/[+#!?]+/g, '');

    // Promotion (e.g., e8=Q)
    let promo = null;
    const promoMatch = san.match(/=([QRNB])/i);
    if (promoMatch) promo = promoMatch[1].toUpperCase();

    // Capture?
    const isCapture = san.includes('x');

    // Determine piece
    let pieceChar = 'P';
    let idx = 0;
    const first = san[0];
    if ('RNBQK'.includes(first)) {
      pieceChar = first;
      idx++;
    }

    // Disambiguation (like Nbd2 or R1e1)
    let disFile = null, disRank = null;
    // Extract squares pattern at end
    const toSqMatch = san.match(/([a-h][1-8])$/);
    if (!toSqMatch) return false;
    const toSq = toSqMatch[1];

    // The part between piece designator/captures and to-square may include disambiguation
    const middle = san.slice(idx, san.length - toSq.length);
    // Remove capture marker
    const mid = middle.replace('x', '');

    if (mid.length === 2 && /^[a-h][1-8]$/.test(mid)) {
      // Full source specified -> rare in SAN, but handle
      disFile = mid[0];
      disRank = mid[1];
    } else if (mid.length === 1) {
      if (/[a-h]/.test(mid)) disFile = mid;
      else if (/[1-8]/.test(mid)) disRank = mid;
    }

    // Find candidate sources by piece type and movement rules
    const candidates = findCandidates(b, pieceChar, toSq, whiteToMove, isCapture);

    // Filter by disambiguation
    const filtered = candidates.filter(sq => {
      if (disFile && sq[0] !== disFile) return false;
      if (disRank && sq[1] !== disRank) return false;
      return true;
    });

    if (filtered.length === 0) return false;

    // Prefer a single match; if multiple, pick the one that matches path legality
    const fromSq = filtered.find(src => pathIsClear(b, src, toSq)) || filtered[0];

    // Apply move
    const from = squareToRC(fromSq);
    const to = squareToRC(toSq);

    // Promotion for pawns
    const movingPiece = b[from.r][from.f];
    b[to.r][to.f] = (promo && movingPiece && movingPiece.toUpperCase() === 'P')
      ? (whiteToMove ? promo : promo.toLowerCase())
      : movingPiece;
    b[from.r][from.f] = null;

    // Simple en passant (best effort): detect pawn diagonal capture to empty square
    if (movingPiece && movingPiece.toUpperCase() === 'P' && isCapture && b[to.r][to.f] && false) {
      // Omitted complex EP resolution for simplicity
    }

    return true;
  }

  function castle(b, whiteToMove, long) {
    // long: queen-side; short: king-side
    if (whiteToMove) {
      // Ensure pieces
      const k = b[7][4] === 'K';
      const rQ = b[7][0] === 'R';
      const rK = b[7][7] === 'R';
      if (long && k && rQ) {
        // Move king e1 -> c1, rook a1 -> d1
        b[7][2] = 'K'; b[7][4] = null;
        b[7][3] = 'R'; b[7][0] = null;
        return true;
      }
      if (!long && k && rK) {
        // King e1 -> g1, rook h1 -> f1
        b[7][6] = 'K'; b[7][4] = null;
        b[7][5] = 'R'; b[7][7] = null;
        return true;
      }
    } else {
      const k = b[0][4] === 'k';
      const rQ = b[0][0] === 'r';
      const rK = b[0][7] === 'r';
      if (long && k && rQ) {
        b[0][2] = 'k'; b[0][4] = null;
        b[0][3] = 'r'; b[0][0] = null;
        return true;
      }
      if (!long && k && rK) {
        b[0][6] = 'k'; b[0][4] = null;
        b[0][5] = 'r'; b[0][7] = null;
        return true;
      }
    }
    return false;
  }

  function pathIsClear(b, fromSq, toSq) {
    // For sliding pieces (R,B,Q) ensure no blockers; knights/pawns/kings ignored
    const from = squareToRC(fromSq);
    const to = squareToRC(toSq);
    const piece = b[from.r][from.f];
    if (!piece) return false;
    const P = piece.toUpperCase();
    if (P === 'N' || P === 'K' || P === 'P') return true;

    const dr = Math.sign(to.r - from.r);
    const df = Math.sign(to.f - from.f);
    let r = from.r + dr, f = from.f + df;
    while (r !== to.r || f !== to.f) {
      if (b[r][f]) return false;
      r += dr; f += df;
    }
    return true;
  }

  function findCandidates(b, pieceChar, toSq, whiteToMove, isCapture) {
    const to = squareToRC(toSq);
    const out = [];
    const targetColor = whiteToMove ? 'upper' : 'lower';

    const isOur = (p) => p && ((whiteToMove && p === p.toUpperCase()) || (!whiteToMove && p === p.toLowerCase()));
    const isOpp = (p) => p && !isOur(p);

    // Scan board for our pieces of type pieceChar
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const p = b[r][f];
        if (!isOur(p)) continue;
        if (p.toUpperCase() !== pieceChar) continue;

        const fromSq = rcToSquare(r, f);
        if (canPieceMove(b, r, f, to.r, to.f, pieceChar, whiteToMove)) {
          // Capture consistency check
          const destPiece = b[to.r][to.f];
          if (isCapture && !destPiece && pieceChar !== 'P') {
            // For non-pawn captures, require a piece on destination
            // (pawns can capture EP; we skip strict EP for simplicity)
            continue;
          }
          if (!isCapture && destPiece) continue;
          out.push(fromSq);
        }
      }
    }

    // Pawns special: accept diagonal capture when destination has opponent piece
    if (pieceChar === 'P') {
      const dir = whiteToMove ? -1 : 1;
      const rf = to.r + dir, lf = to.f - 1, rf2 = to.r + dir, rf3 = to.f + 1;
      // handled in canPieceMove
    }

    return out;
  }

  function canPieceMove(b, r1, f1, r2, f2, piece, whiteToMove) {
    const dr = r2 - r1;
    const df = f2 - f1;
    const abs = (n) => Math.abs(n);

    const destPiece = b[r2][f2];
    const isOur = (p) => p && ((whiteToMove && p === p.toUpperCase()) || (!whiteToMove && p === p.toLowerCase()));
    if (isOur(destPiece)) return false;

    switch (piece) {
      case 'P': {
        const dir = whiteToMove ? -1 : 1;
        // Forward one
        if (df === 0 && dr === dir && !destPiece) return true;
        // Forward two from start rank
        const startRank = whiteToMove ? 6 : 1;
        if (df === 0 && dr === 2 * dir && r1 === startRank && !destPiece && !b[r1 + dir][f1]) return true;
        // Diagonal capture
        if (abs(df) === 1 && dr === dir && destPiece && !isOur(destPiece)) return true;
        // Ignore en passant for simplicity
        return false;
      }
      case 'N': return (abs(dr) === 2 && abs(df) === 1) || (abs(dr) === 1 && abs(df) === 2);
      case 'B': {
        if (abs(dr) !== abs(df)) return false;
        return pathIsClear(b, rcToSquare(r1, f1), rcToSquare(r2, f2));
      }
      case 'R': {
        if (!(dr === 0 || df === 0)) return false;
        return pathIsClear(b, rcToSquare(r1, f1), rcToSquare(r2, f2));
      }
      case 'Q': {
        if (!(abs(dr) === abs(df) || dr === 0 || df === 0)) return false;
        return pathIsClear(b, rcToSquare(r1, f1), rcToSquare(r2, f2));
      }
      case 'K': {
        return abs(dr) <= 1 && abs(df) <= 1;
      }
      default: return false;
    }
  }

  // --- UI helpers ---
  function flashStatus(msg, isError) {
    statusEl.textContent = msg;
    statusEl.style.color = isError ? 'var(--bad)' : 'var(--muted)';
    setTimeout(() => { statusEl.textContent = ''; }, 2500);
  }

  function highlightCurrentSquares() {
    // Remove old highlights
    [...boardEl.querySelectorAll('.square')].forEach(s => s.classList.remove('highlight'));
    if (!currentGame || plyIndex <= 0) return;
    const prevSAN = currentGame.moves[plyIndex - 1];
    // Attempt to highlight destination square of previous move
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
    flashStatus(`Loaded file: ${file.name}`, false);
  });

  clearBtn.addEventListener('click', () => {
    pgnText.value = '';
    gameSelect.innerHTML = '';
    currentGame = null;
    setupFromStart();
    flashStatus('Cleared', false);
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
    flashStatus('Loaded demo PGN', false);
  });

  importBtn.addEventListener('click', () => {
    const text = pgnText.value.trim();
    if (!text) return flashStatus('Paste PGN or load a file', true);
    games = parsePGN(text);
    gameSelect.innerHTML = '';
    if (!games.length) {
      flashStatus('No games parsed', true);
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
    flashStatus(`Imported ${games.length} game(s)`, false);
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
