    import { Chess } from "./chess.esm.js";

    const $ = (id) => document.getElementById(id);
    const FILES = "abcdefgh";
    const squareLayer = $("squareLayer");
    const board = $("board");
    const arrowLine = $("bestMoveArrow");
    const drawLayer = $("drawLayer");
    const evalGraph = $("evalGraph");
    const graphCtx = evalGraph?.getContext("2d");
    const squareEls = new Map();

    let orientationWhite = true;
    let chess = new Chess();
    let initialFen = chess.fen();
    let moves = [];
    let moveIndex = 0;
    let loadedGames = [];
    let currentGameIndex = -1;
    let selectedSquare = "";
    let legalTargets = [];
    let lastMoveSquares = [];
    let playTimer = null;

    let engine = null;
    let engineReady = false;
    let engineSearching = false;
    let queuedFen = null;
    let latestPv = new Map();
    let currentSearchFen = "";
    let autoAnalyzeTimer = null;
    let evalByPly = [];
    let moveAnnotations = [];
    let batchRunning = false;
    let bestMoveUci = "";
    const evalCache = new Map();
    const userArrows = new Set();
    const userMarks = new Set();
    let drawStartSquare = "";

    function setStatus(msg) {
      const el = $("status");
      if (el) el.textContent = msg;
    }

    function setEngineBadge(text) {
      const el = $("engineBadge");
      if (el) el.textContent = `Engine: ${text}`;
    }

    function setPlayButton() {
      const btn = $("playBtn");
      if (btn) btn.textContent = playTimer ? "⏸ Pause" : "▶ Play";
    }

    function getDepth() {
      const val = Number($("depthInput")?.value || 15);
      return Math.max(6, Math.min(30, Number.isFinite(val) ? val : 15));
    }

    function getMultiPv() {
      const val = Number($("multiPvInput")?.value || 3);
      return Math.max(1, Math.min(5, Number.isFinite(val) ? val : 3));
    }

    function autoAnalyzeEnabled() {
      return Boolean($("autoAnalyze")?.checked);
    }

    function infiniteAnalyzeEnabled() {
      return Boolean($("infiniteAnalyze")?.checked);
    }

    function postEngine(command) {
      if (engine) engine.postMessage(command);
    }

    function applyEngineOptions() {
      if (!engineReady) return;
      postEngine(`setoption name MultiPV value ${getMultiPv()}`);
      postEngine("setoption name Threads value 1");
      postEngine("setoption name Hash value 32");
    }

    function parseUciMove(move) {
      if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move)) return null;
      const parsed = { from: move.slice(0, 2), to: move.slice(2, 4) };
      if (move.length === 5) parsed.promotion = move[4];
      return parsed;
    }

    function scoreToCp(score) {
      if (!score) return 0;
      if (score.type === "cp") return score.value;
      const sign = score.value >= 0 ? 1 : -1;
      return sign * (100000 - Math.min(50, Math.abs(score.value)) * 1000);
    }

    function toWhiteScore(score, fen) {
      const side = fen.split(" ")[1];
      const sign = side === "w" ? 1 : -1;
      return { type: score.type, value: score.value * sign };
    }

    function formatScore(score) {
      if (!score) return "—";
      if (score.type === "mate") return `#${score.value}`;
      const pawns = score.value / 100;
      const sign = pawns > 0 ? "+" : "";
      return `${sign}${pawns.toFixed(2)}`;
    }

    function scoreClass(score) {
      if (!score) return "";
      return score.value >= 0 ? "good" : "bad";
    }

    function evalPercent(score) {
      if (!score) return 50;
      if (score.type === "mate") return score.value > 0 ? 99 : 1;
      const cp = Math.max(-1200, Math.min(1200, score.value));
      return 50 + 45 * Math.tanh(cp / 350);
    }

    function renderEval(score) {
      const evalText = $("evalText");
      const evalBar = $("evalBar");
      if (evalText) evalText.textContent = formatScore(score);
      if (evalBar) evalBar.style.height = `${evalPercent(score)}%`;
    }

    function coordToSquare(file, rankIdx) {
      return `${FILES[file]}${8 - rankIdx}`;
    }

    function squareToCoord(square) {
      const file = FILES.indexOf(square[0]);
      const rankIdx = 8 - Number(square[1]);
      return { file, rankIdx };
    }

    function actualToDisplay(file, rankIdx) {
      return orientationWhite
        ? { dFile: file, dRank: rankIdx }
        : { dFile: 7 - file, dRank: 7 - rankIdx };
    }

    function displayToActual(dFile, dRank) {
      return orientationWhite
        ? { file: dFile, rankIdx: dRank }
        : { file: 7 - dFile, rankIdx: 7 - dRank };
    }

    function boardCenterPct(square) {
      const { file, rankIdx } = squareToCoord(square);
      const { dFile, dRank } = actualToDisplay(file, rankIdx);
      return { x: (dFile + 0.5) * 12.5, y: (dRank + 0.5) * 12.5 };
    }

    function drawBestMoveArrow(uciMove) {
      if (!uciMove || !arrowLine) return;
      const parsed = parseUciMove(uciMove);
      if (!parsed) {
        arrowLine.style.display = "none";
        return;
      }
      const a = boardCenterPct(parsed.from);
      const b = boardCenterPct(parsed.to);
      arrowLine.setAttribute("x1", String(a.x));
      arrowLine.setAttribute("y1", String(a.y));
      arrowLine.setAttribute("x2", String(b.x));
      arrowLine.setAttribute("y2", String(b.y));
      arrowLine.style.display = "block";
    }

    function hideBestMoveArrow() {
      if (arrowLine) arrowLine.style.display = "none";
    }

    function renderUserDrawings() {
      if (!drawLayer) return;
      drawLayer.innerHTML = "";
      for (const key of userArrows) {
        const [from, to] = key.split("-");
        if (!from || !to) continue;
        const a = boardCenterPct(from);
        const b = boardCenterPct(to);
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", String(a.x));
        line.setAttribute("y1", String(a.y));
        line.setAttribute("x2", String(b.x));
        line.setAttribute("y2", String(b.y));
        line.setAttribute("stroke", "rgba(251, 191, 36, 0.86)");
        line.setAttribute("stroke-width", "1.3");
        line.setAttribute("marker-end", "url(#userArrowHead)");
        drawLayer.appendChild(line);
      }
      for (const sq of userMarks) {
        const p = boardCenterPct(sq);
        const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        c.setAttribute("cx", String(p.x));
        c.setAttribute("cy", String(p.y));
        c.setAttribute("r", "4.2");
        c.setAttribute("fill", "none");
        c.setAttribute("stroke", "rgba(251, 191, 36, 0.9)");
        c.setAttribute("stroke-width", "1.1");
        drawLayer.appendChild(c);
      }
    }

    function pvToSan(pv, fen) {
      if (!pv) return "";
      const line = new Chess(fen);
      const sans = [];
      for (const move of pv.trim().split(/\s+/)) {
        const parsed = parseUciMove(move);
        if (!parsed) break;
        const out = line.move(parsed);
        if (!out) break;
        sans.push(out.san);
      }
      return sans.join(" ");
    }

    function playFirstPvMove(pv) {
      const first = pv?.trim().split(/\s+/)[0];
      const parsed = parseUciMove(first || "");
      if (!parsed) return;
      const move = chess.move({ ...parsed, promotion: parsed.promotion || "q" });
      if (!move) return;
      onUserMoveApplied(move);
    }

    function renderPvLines() {
      const box = $("pvLines");
      if (!box) return;
      box.innerHTML = "";
      const lines = [...latestPv.entries()].sort((a, b) => a[0] - b[0]);
      for (const [idx, info] of lines) {
        const card = document.createElement("div");
        card.className = "line";
        card.innerHTML = `
          <div class="pvhead">
            <span class="tiny">PV ${idx}</span>
            <span class="score ${scoreClass(info.score)}">${formatScore(info.score)}</span>
          </div>
          <div class="pv">${pvToSan(info.pv, currentSearchFen) || info.pv}</div>
        `;
        card.addEventListener("click", () => playFirstPvMove(info.pv));
        box.appendChild(card);
      }
    }

    function stopAnalysis(status = "Analysis stopped.") {
      if (!engine || !engineReady) return;
      queuedFen = null;
      if (engineSearching) {
        postEngine("stop");
      }
      setStatus(status);
    }

    function startSearch(fen) {
      currentSearchFen = fen;
      latestPv.clear();
      bestMoveUci = "";
      renderPvLines();
      renderEval(null);
      hideBestMoveArrow();
      $("depthText") && ($("depthText").textContent = "—");
      $("nodesText") && ($("nodesText").textContent = "—");
      applyEngineOptions();
      postEngine(`position fen ${fen}`);
      postEngine(infiniteAnalyzeEnabled() ? "go infinite" : `go depth ${getDepth()}`);
      engineSearching = true;
      setStatus(infiniteAnalyzeEnabled() ? "Analyzing (infinite)..." : `Analyzing depth ${getDepth()}...`);
    }

    function analyzePosition() {
      if (!engineReady) {
        setStatus("Engine not ready yet.");
        return;
      }
      const newFen = chess.fen();
      if (engineSearching) {
        queuedFen = newFen;
        postEngine("stop");
        setStatus("Stopping engine...");
        return;
      }
      startSearch(newFen);
    }

    function maybeAutoAnalyze(delayMs = 120) {
      if (!autoAnalyzeEnabled() || !engineReady || batchRunning) return;
      if (autoAnalyzeTimer) clearTimeout(autoAnalyzeTimer);
      autoAnalyzeTimer = setTimeout(() => {
        autoAnalyzeTimer = null;
        analyzePosition();
      }, delayMs);
    }

    function parseScoreFromInfoLine(line, fen) {
      const cp = line.match(/\bscore cp (-?\d+)/);
      const mate = line.match(/\bscore mate (-?\d+)/);
      if (!cp && !mate) return null;
      const raw = cp
        ? { type: "cp", value: Number(cp[1]) }
        : { type: "mate", value: Number(mate[1]) };
      return toWhiteScore(raw, fen);
    }

    function initEngine() {
      try {
        setEngineBadge("loading...");
        engine = new Worker(new URL("./stockfish-17.1-lite-single-03e3232.js", import.meta.url));
      } catch (err) {
        console.error("Worker start failed:", err);
        setEngineBadge("failed");
        setStatus("Engine failed to start.");
        return;
      }

      engine.onerror = (err) => {
        console.error("Engine worker error:", err);
        engineReady = false;
        engineSearching = false;
        setEngineBadge("error");
        setStatus("Engine error. Check console for details.");
      };

      engine.onmessage = (event) => {
        const line = String(event.data || "").trim();
        if (!line) return;

        if (line === "uciok") {
          postEngine("isready");
          return;
        }

        if (line === "readyok") {
          engineReady = true;
          applyEngineOptions();
          setEngineBadge("ready");
          setStatus("Engine ready.");
          maybeAutoAnalyze(0);
          return;
        }

        if (line.startsWith("bestmove")) {
          engineSearching = false;
          const bm = line.match(/^bestmove\s+([a-h][1-8][a-h][1-8][qrbn]?)/)?.[1] || "";
          bestMoveUci = bm;
          drawBestMoveArrow(bestMoveUci);
          
          if (queuedFen) {
            const fen = queuedFen;
            queuedFen = null;
            startSearch(fen);
          } else {
            setStatus("Analysis complete.");
          }
          return;
        }

        if (!line.startsWith("info ") || !engineSearching) return;

        const depth = Number(line.match(/\bdepth (\d+)/)?.[1] || 0);
        const nodes = line.match(/\bnodes (\d+)/)?.[1] || "—";
        const multipv = Number(line.match(/\bmultipv (\d+)/)?.[1] || 1);
        const pv = line.match(/\bpv (.+)$/)?.[1] || "";
        const score = parseScoreFromInfoLine(line, currentSearchFen || chess.fen());
        if (!score) return;

        latestPv.set(multipv, { score, depth, nodes, pv });
        if (multipv === 1) {
          $("depthText") && ($("depthText").textContent = String(depth || "—"));
          $("nodesText") && ($("nodesText").textContent = String(nodes));
          renderEval(score);
          const cpVal = scoreToCp(score);
          evalCache.set(currentSearchFen, cpVal);
          if (moveIndex >= 0) {
            if (evalByPly.length < moves.length + 1) evalByPly = Array(moves.length + 1).fill(null);
            evalByPly[moveIndex] = cpVal;
            drawEvalGraph();
          }
          const first = pv.trim().split(/\s+/)[0] || "";
          bestMoveUci = first;
          drawBestMoveArrow(bestMoveUci);
        }
        renderPvLines();
      };

      postEngine("uci");
    }

    function createSquareGrid() {
      squareLayer.innerHTML = "";
      squareEls.clear();
      for (let dRank = 0; dRank < 8; dRank++) {
        for (let dFile = 0; dFile < 8; dFile++) {
          const { file, rankIdx } = displayToActual(dFile, dRank);
          const sq = coordToSquare(file, rankIdx);
          const el = document.createElement("div");
          el.className = "sq";
          el.dataset.square = sq;
          el.addEventListener("click", () => onSquareClick(sq));
          squareLayer.appendChild(el);
          squareEls.set(sq, el);
        }
      }
      renderSquareHighlights();
      drawBestMoveArrow(bestMoveUci);
      renderUserDrawings();
    }

    function clearBoard() {
      board.querySelectorAll(".piece").forEach((p) => p.remove());
    }

    function placePiece(code, file, rankIdx) {
      const { dFile, dRank } = actualToDisplay(file, rankIdx);
      const img = document.createElement("img");
      img.src = `./pieces/${code}.svg`;
      img.className = "piece";
      img.style.left = `${dFile * 12.5}%`;
      img.style.top = `${dRank * 12.5}%`;
      img.draggable = false;
      board.appendChild(img);
    }

    function renderBoard() {
      clearBoard();
      const rows = chess.board();
      for (let rankIdx = 0; rankIdx < 8; rankIdx++) {
        for (let file = 0; file < 8; file++) {
          const piece = rows[rankIdx][file];
          if (!piece) continue;
          placePiece(`${piece.color}${piece.type.toUpperCase()}`, file, rankIdx);
        }
      }
      renderSquareHighlights();
      drawBestMoveArrow(bestMoveUci);
      renderUserDrawings();
    }

    function renderSquareHighlights() {
      squareEls.forEach((el) => el.classList.remove("highlight", "lastmove"));
      if (selectedSquare && squareEls.has(selectedSquare)) {
        squareEls.get(selectedSquare).classList.add("highlight");
      }
      for (const sq of legalTargets) {
        if (squareEls.has(sq)) squareEls.get(sq).classList.add("highlight");
      }
      for (const sq of lastMoveSquares) {
        if (squareEls.has(sq)) squareEls.get(sq).classList.add("lastmove");
      }
    }

    function updateMoveListHighlight() {
      const list = $("moveList");
      if (!list) return;
      list.querySelectorAll(".move-pill").forEach((el) => {
        el.classList.toggle("active", Number(el.dataset.ply || "0") === moveIndex);
      });
    }

    function updateMeta() {
      $("plyInfo") && ($("plyInfo").textContent = `${moveIndex} / ${moves.length}`);
      $("turnInfo") && ($("turnInfo").textContent = chess.turn() === "w" ? "White" : "Black");
      $("fenInfo") && ($("fenInfo").textContent = chess.fen());
      if ($("fenInput")) $("fenInput").value = chess.fen();
      updateMoveListHighlight();
      drawEvalGraph();
    }

    function classifyMove(cpl) {
      if (cpl >= 250) return { text: "??", cls: "bad", label: "Blunder" };
      if (cpl >= 120) return { text: "?", cls: "bad", label: "Mistake" };
      if (cpl >= 60) return { text: "?!", cls: "warn", label: "Inaccuracy" };
      if (cpl <= 15) return { text: "!", cls: "good", label: "Best" };
      return { text: "", cls: "", label: "Good" };
    }

    function computeMoveAnnotations() {
      moveAnnotations = Array(moves.length).fill(null);
      if (evalByPly.length < moves.length + 1) return;
      const tmp = new Chess();
      tmp.load(initialFen);
      let total = 0;
      let count = 0;

      for (let i = 0; i < moves.length; i++) {
        const before = evalByPly[i];
        const after = evalByPly[i + 1];
        if (before == null || after == null) {
          tmp.move(moves[i]);
          continue;
        }
        const mover = tmp.turn();
        const cpl = mover === "w" ? Math.max(0, before - after) : Math.max(0, after - before);
        const cls = classifyMove(cpl);
        moveAnnotations[i] = { cpl, ...cls };
        total += cpl;
        count++;
        tmp.move(moves[i]);
      }

      const acpl = count ? (total / count).toFixed(1) : "—";
      $("acplText") && ($("acplText").textContent = `ACPL: ${acpl}`);
    }

    function renderMoveList() {
      const list = $("moveList");
      if (!list) return;
      list.innerHTML = "";
      if (!moves.length) {
        list.textContent = "Moves will appear here...";
        return;
      }
      moves.forEach((m, i) => {
        const ann = moveAnnotations[i];
        const span = document.createElement("span");
        span.className = `move-pill ${ann?.cls || ""}`.trim();
        span.dataset.ply = String(i + 1);
        span.textContent = ann?.text ? `${m.san} ${ann.text}` : m.san;
        span.title = ann ? `${ann.label} · CPL ${ann.cpl.toFixed(0)}` : m.san;
        span.onclick = () => jumpTo(i + 1);
        list.appendChild(span);
      });
      updateMoveListHighlight();
    }

    function drawEvalGraph() {
      if (!graphCtx || !evalGraph) return;
      const w = evalGraph.width;
      const h = evalGraph.height;
      graphCtx.clearRect(0, 0, w, h);
      graphCtx.fillStyle = "rgba(0,0,0,0.15)";
      graphCtx.fillRect(0, 0, w, h);
      graphCtx.strokeStyle = "rgba(255,255,255,0.2)";
      graphCtx.beginPath();
      graphCtx.moveTo(0, h / 2);
      graphCtx.lineTo(w, h / 2);
      graphCtx.stroke();

      if (evalByPly.length < 2) return;
      graphCtx.strokeStyle = "rgba(34, 211, 238, 0.95)";
      graphCtx.lineWidth = 2;
      graphCtx.beginPath();
      evalByPly.forEach((cp, i) => {
        const x = (i / Math.max(1, evalByPly.length - 1)) * w;
        const clipped = Math.max(-800, Math.min(800, cp || 0));
        const y = h / 2 - (clipped / 800) * (h / 2 - 8);
        if (i === 0) graphCtx.moveTo(x, y);
        else graphCtx.lineTo(x, y);
      });
      graphCtx.stroke();

      const markerX = (moveIndex / Math.max(1, moves.length || 1)) * w;
      graphCtx.fillStyle = "rgba(124, 92, 255, 0.95)";
      graphCtx.fillRect(markerX - 1, 0, 2, h);
    }

    function normalizePGN(pgn) {
      let normalized = pgn.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
      if (!normalized) return "";
      const lines = normalized.split("\n");
      let headerEnd = 0;
      while (headerEnd < lines.length && /^\s*\[[^\]]+\]\s*$/.test(lines[headerEnd])) {
        headerEnd++;
      }
      if (headerEnd > 0 && lines[headerEnd] !== "") lines.splice(headerEnd, 0, "");
      return lines.join("\n").trim();
    }

    function ensureTrailingResult(pgn) {
      if (!pgn) return pgn;
      return /\b(1-0|0-1|1\/2-1\/2|\*)\s*$/.test(pgn) ? pgn : `${pgn} *`;
    }

    function parseGames(raw) {
      const normalized = normalizePGN(raw);
      if (!normalized) return [];
      const chunks = normalized.includes("[Event")
        ? normalized.split(/(?=^\[Event\s)/gm).map((s) => s.trim()).filter(Boolean)
        : [normalized];
      const parsed = [];
      for (const chunk of chunks) {
        const cleaned = normalizePGN(chunk);
        const attempts = [cleaned];
        const withResult = ensureTrailingResult(cleaned);
        if (withResult !== cleaned) attempts.push(withResult);
        for (const candidate of attempts) {
          try {
            const test = new Chess();
            test.loadPgn(candidate);
            const headers = test.getHeaders();
            const startFen = Object.entries(headers).find(([k]) => k.toLowerCase() === "fen")?.[1] || new Chess().fen();
            parsed.push({
              headers,
              initialFen: startFen,
              moves: test.history({ verbose: true }),
              pgn: test.pgn()
            });
            break;
          } catch (_err) {
          }
        }
      }
      return parsed;
    }

    function gameLabel(game, idx) {
      const white = game.headers.White || "White";
      const black = game.headers.Black || "Black";
      const result = game.headers.Result || "*";
      return `${idx + 1}. ${white} vs ${black} (${result})`;
    }

    function renderGameSelect() {
      const select = $("gameSelect");
      if (!select) return;
      select.innerHTML = "";
      if (!loadedGames.length) {
        const empty = document.createElement("option");
        empty.textContent = "No games loaded";
        empty.disabled = true;
        empty.selected = true;
        select.appendChild(empty);
        return;
      }
      loadedGames.forEach((game, idx) => {
        const opt = document.createElement("option");
        opt.value = String(idx);
        opt.textContent = gameLabel(game, idx);
        select.appendChild(opt);
      });
      if (currentGameIndex >= 0) select.value = String(currentGameIndex);
    }

    function syncLastMoveSquares() {
      const last = moves[moveIndex - 1];
      lastMoveSquares = last ? [last.from, last.to] : [];
    }

    function recomputeEvalPathFromCache() {
      const tmp = new Chess();
      tmp.load(initialFen);
      const path = [evalCache.get(tmp.fen()) ?? 0];
      for (const m of moves) {
        tmp.move(m);
        path.push(evalCache.get(tmp.fen()) ?? null);
      }
      evalByPly = path;
      computeMoveAnnotations();
      renderMoveList();
      drawEvalGraph();
    }

    function jumpTo(n) {
      const ply = Math.max(0, Math.min(moves.length, n));
      selectedSquare = "";
      legalTargets = [];
      chess.load(initialFen);
      for (let i = 0; i < ply; i++) chess.move(moves[i]);
      moveIndex = ply;
      syncLastMoveSquares();
      renderBoard();
      updateMeta();
      maybeAutoAnalyze();
    }

    function loadGame(index) {
      const game = loadedGames[index];
      if (!game) return;
      stopPlayback();
      currentGameIndex = index;
      initialFen = game.initialFen;
      moves = game.moves.map((m) => ({ ...m }));
      evalByPly = Array(moves.length + 1).fill(null);
      moveAnnotations = Array(moves.length).fill(null);
      renderMoveList();
      jumpTo(0);
      renderGameSelect();
      setStatus(`Loaded game ${index + 1}/${loadedGames.length} (${moves.length} ply).`);
    }

    function importPGN(raw) {
      loadedGames = parseGames(raw);
      if (!loadedGames.length) {
        setStatus("❌ PGN rejected: no valid games found.");
        return;
      }
      renderGameSelect();
      loadGame(0);
      setStatus(`Loaded ${loadedGames.length} game(s).`);
    }

    function onUserMoveApplied(move) {
      stopPlayback();
      currentGameIndex = -1;
      moves = chess.history({ verbose: true });
      moveIndex = moves.length;
      syncLastMoveSquares();
      selectedSquare = "";
      legalTargets = [];
      evalByPly = Array(moves.length + 1).fill(null);
      moveAnnotations = Array(moves.length).fill(null);
      renderMoveList();
      renderBoard();
      updateMeta();
      setStatus(`Played ${move.san}`);
      maybeAutoAnalyze();
    }

    function onSquareClick(square) {
      const piece = chess.get(square);
      if (!selectedSquare) {
        if (!piece || piece.color !== chess.turn()) return;
        selectedSquare = square;
        legalTargets = chess.moves({ square, verbose: true }).map((m) => m.to);
        renderSquareHighlights();
        return;
      }
      if (square === selectedSquare) {
        selectedSquare = "";
        legalTargets = [];
        renderSquareHighlights();
        return;
      }
      const move = chess.move({ from: selectedSquare, to: square, promotion: "q" });
      if (move) {
        onUserMoveApplied(move);
        return;
      }
      if (piece && piece.color === chess.turn()) {
        selectedSquare = square;
        legalTargets = chess.moves({ square, verbose: true }).map((m) => m.to);
      } else {
        selectedSquare = "";
        legalTargets = [];
      }
      renderSquareHighlights();
    }

    function nextMove() {
      if (moveIndex >= moves.length) return;
      jumpTo(moveIndex + 1);
    }

    function prevMove() {
      if (moveIndex <= 0) return;
      jumpTo(moveIndex - 1);
    }

    function resetGame() {
      jumpTo(0);
    }

    function startPlayback() {
      if (playTimer || !moves.length) return;
      playTimer = setInterval(() => {
        if (moveIndex >= moves.length) {
          stopPlayback();
          return;
        }
        nextMove();
      }, 700);
      setPlayButton();
    }

    function stopPlayback() {
      if (!playTimer) return;
      clearInterval(playTimer);
      playTimer = null;
      setPlayButton();
    }

    function togglePlayback() {
      if (playTimer) stopPlayback();
      else startPlayback();
    }

    async function copyFen() {
      const fen = chess.fen();
      try {
        await navigator.clipboard.writeText(fen);
        setStatus("FEN copied.");
      } catch {
        setStatus("Clipboard blocked by browser.");
      }
    }

    function loadFenFromInput() {
      const fen = $("fenInput")?.value?.trim();
      if (!fen) return;
      const ok = chess.load(fen);
      if (!ok) {
        setStatus("Invalid FEN.");
        return;
      }
      stopPlayback();
      currentGameIndex = -1;
      initialFen = fen;
      moves = [];
      moveIndex = 0;
      selectedSquare = "";
      legalTargets = [];
      lastMoveSquares = [];
      userArrows.clear();
      userMarks.clear();
      evalByPly = [evalCache.get(fen) ?? 0];
      moveAnnotations = [];
      renderMoveList();
      renderBoard();
      updateMeta();
      maybeAutoAnalyze(0);
      setStatus("Custom FEN loaded.");
    }

    function downloadCurrentPgn() {
      let text = "";
      if (currentGameIndex >= 0 && loadedGames[currentGameIndex]) {
        text = loadedGames[currentGameIndex].pgn;
      } else {
        const tmp = new Chess();
        tmp.load(initialFen);
        for (const m of moves) tmp.move(m);
        text = tmp.pgn();
      }
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "analysis.pgn";
      a.click();
      URL.revokeObjectURL(a.href);
    }

    function buildFenPath() {
      const tmp = new Chess();
      tmp.load(initialFen);
      const fens = [tmp.fen()];
      for (const m of moves) {
        tmp.move(m);
        fens.push(tmp.fen());
      }
      return fens;
    }

    async function analyzeFenWithWorker(worker, fen, depth) {
      return new Promise((resolve, reject) => {
        let lastScore = null;
        const onMessage = (event) => {
          const line = String(event.data || "").trim();
          if (!line) return;
          if (line.startsWith("info ")) {
            const score = parseScoreFromInfoLine(line, fen);
            const mpv = Number(line.match(/\bmultipv (\d+)/)?.[1] || 1);
            if (score && mpv === 1) lastScore = score;
          } else if (line.startsWith("bestmove")) {
            worker.removeEventListener("message", onMessage);
            const best = line.match(/^bestmove\s+([a-h][1-8][a-h][1-8][qrbn]?)/)?.[1] || "";
            resolve({ score: lastScore || { type: "cp", value: 0 }, bestMove: best });
          }
        };
        worker.addEventListener("message", onMessage);
        try {
          worker.postMessage(`position fen ${fen}`);
          worker.postMessage(`go depth ${depth}`);
        } catch (err) {
          worker.removeEventListener("message", onMessage);
          reject(err);
        }
      });
    }

    async function createReadyWorker() {
      const worker = new Worker(new URL("./stockfish-17.1-lite-single-03e3232.js", import.meta.url));
      await new Promise((resolve, reject) => {
        const onMessage = (event) => {
          const line = String(event.data || "").trim();
          if (line === "uciok") {
            worker.postMessage("setoption name MultiPV value 1");
            worker.postMessage("setoption name Threads value 1");
            worker.postMessage("setoption name Hash value 16");
            worker.postMessage("isready");
          } else if (line === "readyok") {
            worker.removeEventListener("message", onMessage);
            resolve();
          }
        };
        worker.addEventListener("message", onMessage);
        worker.addEventListener("error", reject, { once: true });
        worker.postMessage("uci");
      });
      return worker;
    }

    async function analyzeFullGame() {
      if (batchRunning || !moves.length) return;
      batchRunning = true;
      $("analyzeProgress") && ($("analyzeProgress").textContent = "starting...");
      $("analyzeGameBtn") && ($("analyzeGameBtn").disabled = true);
      try {
        const fens = buildFenPath();
        const worker = await createReadyWorker();
        const depth = Math.min(18, getDepth());
        const vals = [];
        for (let i = 0; i < fens.length; i++) {
          $("analyzeProgress") && ($("analyzeProgress").textContent = `${i}/${fens.length - 1}`);
          const fen = fens[i];
          const { score } = await analyzeFenWithWorker(worker, fen, depth);
          const cp = scoreToCp(score);
          vals.push(cp);
          evalCache.set(fen, cp);
          evalByPly = vals.slice();
          drawEvalGraph();
        }
        worker.postMessage("quit");
        evalByPly = vals;
        computeMoveAnnotations();
        renderMoveList();
        drawEvalGraph();
        $("analyzeProgress") && ($("analyzeProgress").textContent = "done");
        setStatus("Full game analysis complete.");
      } catch (err) {
        console.error(err);
        setStatus("Full game analysis failed.");
        $("analyzeProgress") && ($("analyzeProgress").textContent = "failed");
      } finally {
        batchRunning = false;
        $("analyzeGameBtn") && ($("analyzeGameBtn").disabled = false);
      }
    }

    function handleGraphClick(event) {
      if (!evalGraph || !moves.length) return;
      const rect = evalGraph.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, x / rect.width));
      const ply = Math.round(ratio * moves.length);
      stopPlayback();
      jumpTo(ply);
    }

    function flipBoard() {
      orientationWhite = !orientationWhite;
      createSquareGrid();
      renderBoard();
    }

    function squareFromPointer(event) {
      const rect = board.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const dFile = Math.max(0, Math.min(7, Math.floor((x / rect.width) * 8)));
      const dRank = Math.max(0, Math.min(7, Math.floor((y / rect.height) * 8)));
      const { file, rankIdx } = displayToActual(dFile, dRank);
      return coordToSquare(file, rankIdx);
    }

    function toggleArrowOrMark(from, to) {
      if (!from || !to) return;
      if (from === to) {
        if (userMarks.has(from)) userMarks.delete(from);
        else userMarks.add(from);
      } else {
        const key = `${from}-${to}`;
        if (userArrows.has(key)) userArrows.delete(key);
        else userArrows.add(key);
      }
      renderUserDrawings();
    }

    $("importBtn")?.addEventListener("click", () => importPGN($("pgnText").value));
    $("pastePgnBtn")?.addEventListener("click", async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (!text.trim()) return;
        $("pgnText").value = text;
        importPGN(text);
      } catch {
        setStatus("Clipboard read blocked by browser.");
      }
    });
    $("demoBtn")?.addEventListener("click", () => importPGN("1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Be2 e5 7. Nb3 Be6 *"));
    $("gameSelect")?.addEventListener("change", (event) => loadGame(Number(event.target.value)));
    $("pgnFile")?.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      $("pgnText").value = await file.text();
      setStatus(`Loaded file: ${file.name}`);
    });

    $("clearBtn")?.addEventListener("click", () => {
      stopPlayback();
      $("pgnText").value = "";
      loadedGames = [];
      currentGameIndex = -1;
      chess = new Chess();
      initialFen = chess.fen();
      moves = [];
      moveIndex = 0;
      selectedSquare = "";
      legalTargets = [];
      lastMoveSquares = [];
      userArrows.clear();
      userMarks.clear();
      evalByPly = [0];
      moveAnnotations = [];
      renderGameSelect();
      renderMoveList();
      renderBoard();
      updateMeta();
      setStatus("Cleared.");
    });

    $("firstBtn")?.addEventListener("click", () => { stopPlayback(); jumpTo(0); });
    $("nextBtn")?.addEventListener("click", () => { stopPlayback(); nextMove(); });
    $("prevBtn")?.addEventListener("click", () => { stopPlayback(); prevMove(); });
    $("resetBtn")?.addEventListener("click", () => { stopPlayback(); resetGame(); });
    $("lastBtn")?.addEventListener("click", () => { stopPlayback(); jumpTo(moves.length); });
    $("playBtn")?.addEventListener("click", togglePlayback);
    $("flipBtn")?.addEventListener("click", flipBoard);
    $("copyFenBtn")?.addEventListener("click", copyFen);
    $("loadFenBtn")?.addEventListener("click", loadFenFromInput);
    $("downloadBtn")?.addEventListener("click", downloadCurrentPgn);
    $("analyzeBtn")?.addEventListener("click", analyzePosition);
    $("stopBtn")?.addEventListener("click", () => stopAnalysis("Analysis stopped."));
    $("analyzeGameBtn")?.addEventListener("click", analyzeFullGame);
    $("multiPvInput")?.addEventListener("change", () => {
      applyEngineOptions();
      if (engineReady) maybeAutoAnalyze(0);
    });
    $("depthInput")?.addEventListener("change", () => {
      if (engineReady) maybeAutoAnalyze(0);
    });
    $("autoAnalyze")?.addEventListener("change", () => {
      if (autoAnalyzeEnabled()) maybeAutoAnalyze(0);
    });
    $("fenInput")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") loadFenFromInput();
    });
    evalGraph?.addEventListener("click", handleGraphClick);
    board?.addEventListener("contextmenu", (event) => event.preventDefault());
    board?.addEventListener("mousedown", (event) => {
      if (event.button !== 2) return;
      drawStartSquare = squareFromPointer(event);
      event.preventDefault();
    });
    board?.addEventListener("mouseup", (event) => {
      if (event.button !== 2) return;
      const endSquare = squareFromPointer(event);
      toggleArrowOrMark(drawStartSquare, endSquare);
      drawStartSquare = "";
      event.preventDefault();
    });

    window.addEventListener("keydown", (event) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === "textarea" || tag === "input" || tag === "select") return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        stopPlayback();
        nextMove();
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        stopPlayback();
        prevMove();
      }
      if (event.key.toLowerCase() === "a") {
        event.preventDefault();
        analyzePosition();
      }
      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        flipBoard();
      }
      if (event.key === " ") {
        event.preventDefault();
        togglePlayback();
      }
    });

    createSquareGrid();
    renderGameSelect();
    evalByPly = [0];
    renderMoveList();
    renderBoard();
    updateMeta();
    setPlayButton();
    drawEvalGraph();
    setStatus("Ready. Import a PGN.");
    initEngine();
