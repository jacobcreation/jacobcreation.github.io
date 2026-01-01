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
      // --- PGN parsing ---
  function parsePGN(text) {
    const cleaned = text.replace(/\r\n/g, '\n').trim();
    // Split by blank lines between games OR by tags start
    const chunks = cleaned
      .split(/\n(?=

\[Event\s)|\n{2,}/)   // ✅ regex is properly closed
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

    // Remove move numbers like "12." or "12..."; keep SAN
    s = s.replace(/\b\d+\.(\.\.)?/g, ' ').replace(/\s+/g, ' ').trim();
    const toks = s.split(' ').filter(Boolean);

    // Moves are alternating: White, Black
    return { moves: toks, result };
  }
