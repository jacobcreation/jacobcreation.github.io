    const STORAGE_KEY = "cps_data_v1";
    let MODE = null, ROUND = 0, MAX_ROUNDS = 5, OPEN = false, FINISHED = false;
    let players = [], pairings = [], history = [];
    let TOURNAMENT = "Tournament";

    /* Persistence */
    function saveData() {
      const data = { players, pairings, history, MODE, ROUND, MAX_ROUNDS, OPEN, FINISHED, TOURNAMENT };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }

    function loadData() {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!data) return;

      players = data.players;
      pairings = data.pairings;
      history = data.history;
      MODE = data.MODE;
      ROUND = data.ROUND;
      MAX_ROUNDS = data.MAX_ROUNDS || 5;
      OPEN = data.OPEN;
      FINISHED = data.FINISHED || false;
      TOURNAMENT = data.TOURNAMENT;

      // Fix object references in pairings
      pairings.forEach(p => {
        p.a = players.find(x => x.id === p.a.id);
        p.b = players.find(x => x.id === p.b.id);
      });

      // Restore UI
      if (MODE) {
        modeScreen.classList.add("hidden");
        tournamentScreen.classList.remove("hidden");
        title.textContent = `${TOURNAMENT} (${MODE === "swiss" ? "Swiss" : "Round Robin"})`;
      }
      
      if (FINISHED) {
        showFinalStandings();
      } else {
        updateRoundTitle();
        render();
        if (OPEN || ROUND > 0) renderPairings();
      }
    }

    function updateRoundTitle() {
      const displayTitle = `${TOURNAMENT} — Round ${ROUND}`;
      roundTitle.textContent = ROUND > 0 ? `${displayTitle} ${OPEN ? "(In Progress)" : "(Finalized)"}` : "";
      
      document.querySelectorAll(".print-tournament-name").forEach(el => el.textContent = TOURNAMENT);
      document.querySelectorAll(".print-round-num").forEach(el => el.textContent = ROUND);
    }

    function pushHistory() {
      history.push(JSON.stringify({
        players: JSON.parse(JSON.stringify(players)),
        pairings: JSON.parse(JSON.stringify(pairings)),
        ROUND,
        OPEN,
        FINISHED
      }));
      if (history.length > 50) history.shift();
    }

    function undo() {
      if (!history.length) return;
      const h = JSON.parse(history.pop());
      players = h.players;
      pairings = h.pairings;
      ROUND = h.ROUND;
      OPEN = h.OPEN;
      FINISHED = h.FINISHED || false;

      // Restore references
      pairings.forEach(p => {
        p.a = players.find(x => x.id === p.a.id);
        p.b = players.find(x => x.id === p.b.id);
      });

      if (!FINISHED) {
        finalStandingsCard.classList.add("hidden");
        pairingsCard.classList.remove("no-print");
        nextRoundBtn.classList.remove("hidden");
        finalizeBtn.classList.remove("hidden");
      }

      updateRoundTitle();
      recalculateStandings();
      renderPairings();
      saveData();
    }

    function updateResult(i, val) {
      const p = pairings[i];
      p.res = val;

      if (!OPEN) {
        // Editing a finalized round
        const w = p.a, b = p.b;
        const wIdx = w.opp.lastIndexOf(b.id);
        const bIdx = b.opp.lastIndexOf(w.id);

        if (wIdx !== -1 && bIdx !== -1) {
          const scores = { "1-0": [1, 0], "0-1": [0, 1], "0.5": [0.5, 0.5], "": [0, 0] };
          const [wScore, bScore] = scores[val] || [0, 0];
          w.results[wIdx] = wScore;
          b.results[bIdx] = bScore;
          recalculateStandings();
        }
      }
      saveData();
    }

    /* Start */
    function start(m) {
      
      MODE = m;
      TOURNAMENT = tournamentName.value || "Tournament";
      MAX_ROUNDS = parseInt(maxRoundsInput.value) || 5;
      title.textContent = `${TOURNAMENT} (${m === "swiss" ? "Swiss" : "Round Robin"})`;
      modeScreen.classList.add("hidden");
      tournamentScreen.classList.remove("hidden");
      saveData();
    }

    /* Players */
    function addPlayer() {
      
      if (!pName.value.trim()) return;
      if (players.some(p => p.name.toLowerCase() === pName.value.toLowerCase())) return;
      players.push({
        id: crypto.randomUUID(),
        name: pName.value.trim(),
        rating: +pRating.value || 0,
        score: 0,
        opp: [],        // opponent IDs
        results: [],    // 1, 0.5, 0
        bye: false,
        bh: 0, bh1: 0, sb: 0
      });
      pName.value = ""; pRating.value = "";
      render();
      saveData();
    }

    function removePlayer(id) {
      if (ROUND > 0) return alert("Cannot remove after start");
      players = players.filter(p => p.id !== id);
      render();
      saveData();
    }

    function loadFile(e) {
      const f = e.target.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        r.result.split(/\r?\n/).forEach(l => {
          const [n, rating] = l.split(",");
          if (n && !players.some(p => p.name.toLowerCase() === n.toLowerCase())) {
            players.push({
              id: crypto.randomUUID(),
              name: n.trim(),
              rating: +rating || 0,
              score: 0,
              opp: [],
              results: [],
              bye: false,
              bh: 0, bh1: 0, sb: 0
            });
          }
        });
        render();
        saveData();
      };
      r.readAsText(f);
    }
    
    document.getElementById('fileInput').addEventListener('change', loadFile);

    /* Swiss */
    function nextRound() {
      if (MODE !== "swiss") return;
      if (OPEN) return alert("Finalize current round first");
      if (ROUND >= MAX_ROUNDS) return alert("Tournament already reached max rounds!");

      pushHistory();
      ROUND++; OPEN = true; pairings = [];
      updateRoundTitle();

      let pool = [...players].sort((a, b) => b.score - a.score || b.rating - a.rating);
      let bye = null;

      if (pool.length % 2) {
        bye = pool.find(p => !p.bye);
        if (bye) {
          bye.bye = true;
          bye.score++;
          bye.opp.push(null);
          bye.results.push(1);
          pool = pool.filter(p => p !== bye);
        }
      }

      while (pool.length) {
        let a = pool.shift();
        let b = pool.find(x => !a.opp.includes(x.id)) || pool[0];
        pool = pool.filter(x => x !== b);
        pairings.push({ a, b, res: "" });
      }

      renderPairings();
      recalculateStandings();
      saveData();
    }

    function renderPairings() {
      pairingsEl.innerHTML = "";
      let board = 1;

      pairings.forEach((p, i) => {
        const val = p.res;
        pairingsEl.innerHTML += `
        <tr>
          <td>${board++}</td>
          <td>${p.a.name}</td>
          <td>${p.b.name}</td>
          <td class="result-col">
            <select onchange="updateResult(${i}, this.value)">
              <option value="" ${val === "" ? "selected" : ""}>—</option>
              <option value="1-0" ${val === "1-0" ? "selected" : ""}>1-0</option>
              <option value="0-1" ${val === "0-1" ? "selected" : ""}>0-1</option>
              <option value="0.5" ${val === "0.5" ? "selected" : ""}>½–½</option>
            </select>
          </td>
        </tr>`;
      });

      const byePlayer = players.find(p => !pairings.some(m => m.a.id === p.id || m.b.id === p.id) && p.opp.length === ROUND);
      if (byePlayer) {
        pairingsEl.innerHTML += `
        <tr>
          <td>—</td><td>${byePlayer.name}</td><td>BYE</td>
          <td class="result-col">+1</td>
        </tr>`;
      }
    }

    /* Finalize */
    function finalize() {
      if (!OPEN) return;
      if (pairings.some(p => !p.res)) return alert("Missing results");

      pushHistory();

      pairings.forEach(p => {
        const w = p.a, b = p.b;
        w.opp.push(b.id);
        b.opp.push(w.id);

        if (p.res === "1-0") {
          w.results.push(1); b.results.push(0);
        } else if (p.res === "0-1") {
          b.results.push(1); w.results.push(0);
        } else if (p.res === "0.5") {
          w.results.push(0.5); b.results.push(0.5);
        }
      });

      OPEN = false;
      updateRoundTitle();
      recalculateStandings();
      
      if (ROUND >= MAX_ROUNDS) {
        FINISHED = true;
        showFinalStandings();
      }
      
      saveData();
    }

    function showFinalStandings() {
      FINISHED = true;
      finalStandingsCard.classList.remove("hidden");
      pairingsCard.classList.add("no-print"); // Hide pairings from print in final view
      
      // Hide round control buttons
      nextRoundBtn.classList.add("hidden");
      finalizeBtn.classList.add("hidden");

      const sorted = [...players].sort((a, b) =>
        b.score - a.score ||
        b.bh - a.bh ||
        b.sb - a.sb ||
        b.rating - a.rating
      );

      finalStandingsBody.innerHTML = "";
      sorted.forEach((p, i) => {
        finalStandingsBody.innerHTML += `
          <tr>
            <td>${i + 1}</td>
            <td>${p.name}</td>
            <td>${p.rating}</td>
            <td>${p.score}</td>
            <td>${p.bh.toFixed(2)}</td>
            <td>${p.sb.toFixed(2)}</td>
          </tr>
        `;
      });
    }

    /* Recalculate */
    function recalculateStandings() {
      players.forEach(p => {
        p.score = p.results.reduce((a, b) => a + (b || 0), 0);
      });
      calculateTieBreaks();
      render();
    }

    /* Tie-breaks */
    function calculateTieBreaks() {
      players.forEach(p => {
        let oppScores = [], sb = 0;

        p.opp.forEach((oid, i) => {
          const o = players.find(x => x.id === oid);
          const os = o ? o.score : 0;
          oppScores.push(os);
          sb += os * (p.results[i] || 0);
        });

        p.bh = oppScores.reduce((a, b) => a + b, 0);
        p.bh1 = oppScores.length
          ? p.bh - Math.min(...oppScores)
          : 0;
        p.sb = sb;
      });
    }

    /* Render */
    function render() {
      standings.innerHTML = "";
      [...players].sort((a, b) =>
        b.score - a.score ||
        b.bh - a.bh ||
        b.rating - a.rating
      ).forEach((p, i) => {
        standings.innerHTML += `
    <tr>
      <td>${i + 1}</td>
      <td>${p.name}</td>
      <td>${p.rating}</td>
      <td>${p.score}</td>
      <td class="remove-col"><button class="danger" onclick="removePlayer('${p.id}')">🗑</button></td>
    </tr>`;
      });
    }

    /* Print */
    function printCurrent() {
      window.print();
    }

    /* TRF */
    function exportTRF() {
      let trf = `012 ${TOURNAMENT}\n022 Swiss\n062 ${ROUND}\n`;
      players.forEach((p, i) => {
        trf += `001 ${i + 1} ${p.name} ${p.rating}\n`;
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([trf], { type: "text/plain" }));
      a.download = TOURNAMENT.replace(/\s+/g, "_") + ".trf";
      a.click();
    }

    /* Reset */
    function resetAll() {
      if (confirm("Are you sure? This will delete all tournament data.")) {
        localStorage.removeItem(STORAGE_KEY);
        location.reload();
      }
    }

    /* DOM */
    const standings = document.getElementById("standings");
    const pairingsEl = document.getElementById("pairings");

    /* Prevent Navigation */
    loadData();
