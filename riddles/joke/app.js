    const WORKER_URL = "https://jokeai.b4rjxr9lk.workers.dev/";

    // --- Audio Synthesis ---
    const AudioEngine = {
      ctx: null,
      init() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      },
      play(freq, type = 'sine', duration = 0.1, vol = 0.1) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
      },
      hit() { this.play(150, 'square', 0.2, 0.15); },
      win() { this.play(800, 'sine', 0.3); setTimeout(() => this.play(1200, 'sine', 0.4), 100); },
      lose() { this.play(100, 'sawtooth', 0.5); },
      tick() { this.play(440, 'sine', 0.05, 0.05); }
    };

    // --- Game State ---
    let state = {
      playerHealth: 100,
      enemyHealth: 100,
      score: 0,
      combo: 0,
      difficulty: 15,
      isListening: false,
      laughDetected: false,
      seenJokes: [],
      roundActive: false
    };

    const taunts = [
      "Was it that funny? I didn't even try.",
      "My grandmother has a thicker skin than you.",
      "I've seen rocks with better self-control.",
      "Are you even trying to stay serious?",
      "That was my worst joke. And you still cracked.",
      "Pathetic. The comedy bot is disappointed.",
      "You're making this too easy for me."
    ];

    const els = {
      pHealth: document.getElementById('p-health'),
      eHealth: document.getElementById('e-health'),
      pAvatar: document.getElementById('p-avatar'),
      eAvatar: document.getElementById('e-avatar'),
      pFighter: document.getElementById('p-fighter'),
      eFighter: document.getElementById('e-fighter'),
      setup: document.getElementById('setup'),
      punchline: document.getElementById('punchline'),
      status: document.getElementById('status-text'),
      micDot: document.getElementById('mic-dot'),
      volFill: document.getElementById('vol-fill'),
      startBtn: document.getElementById('start-btn'),
      nextBtn: document.getElementById('next-btn'),
      controls: document.getElementById('game-controls'),
      overlay: document.getElementById('overlay'),
      endTitle: document.getElementById('end-title'),
      taunt: document.getElementById('taunt-text'),
      score: document.getElementById('score-val'),
      finalScore: document.getElementById('final-score'),
      comboPill: document.getElementById('combo-pill'),
      comboVal: document.getElementById('combo-val'),
      diffBtns: document.querySelectorAll('.diff-btn')
    };

    const detector = new LOLD({
      threshold: state.difficulty,
      onLaugh: (vol) => {
        if (state.isListening && !state.laughDetected) playerLaughed();
      }
    });

    // --- Difficulty Handling ---
    els.diffBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (state.roundActive) return;
        els.diffBtns.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        state.difficulty = parseInt(btn.dataset.val);
        detector.threshold = state.difficulty;
        AudioEngine.tick();
      });
    });

    // --- Core Logic ---

    async function initGame() {
      AudioEngine.init();
      const success = await detector.start();
      if (success) {
        els.startBtn.style.display = 'none';
        els.controls.style.display = 'flex';
        els.status.textContent = "System online. Prepare yourself.";

        detector.onVolumeChange = (avg, max) => {
          els.volFill.style.width = Math.min(100, avg * 4) + '%';
          if (avg > detector.threshold) {
            els.volFill.style.background = 'var(--red)';
          } else if (avg > detector.threshold * 0.6) {
            els.volFill.style.background = 'var(--yellow)';
          } else {
            els.volFill.style.background = 'var(--green)';
          }
        };

        fetchJoke();
      } else {
        alert("Microphone access is required for the challenge!");
      }
    }

    function playerLaughed() {
      state.laughDetected = true;
      state.isListening = false;
      detector.setListening(false);
      els.micDot.classList.remove('active');

      AudioEngine.lose();
      state.combo = 0;
      updateStats();

      els.status.textContent = "LAUGHTER DETECTED! ❌";
      els.status.style.color = "var(--red)";
      els.pAvatar.textContent = "🤣";
      els.eAvatar.textContent = "😎";

      takeDamage('player');
      els.nextBtn.disabled = false;
      els.nextBtn.textContent = "Try Again ➡️";
    }

    function botFailed() {
      if (state.laughDetected) return;
      state.laughDetected = true;
      state.isListening = false;
      detector.setListening(false);
      els.micDot.classList.remove('active');

      AudioEngine.win();
      state.combo++;
      state.score += (100 * state.combo) + (state.difficulty === 8 ? 50 : 0);
      updateStats();

      els.status.textContent = "SURVIVED! Bot takes damage. 🗿";
      els.status.style.color = "var(--green)";
      els.pAvatar.textContent = "🗿";
      els.eAvatar.textContent = "😰";

      takeDamage('enemy');
      els.nextBtn.disabled = false;
      els.nextBtn.textContent = "Next Joke ➡️";
    }

    function takeDamage(target) {
      AudioEngine.hit();
      if (target === 'player') {
        state.playerHealth = Math.max(0, state.playerHealth - 25);
        els.pAvatar.classList.add('shake');
        els.pFighter.classList.add('shake');
        setTimeout(() => {
            els.pAvatar.classList.remove('shake');
            els.pFighter.classList.remove('shake');
        }, 600);
      } else {
        state.enemyHealth = Math.max(0, state.enemyHealth - 20);
        els.eAvatar.classList.add('shake');
        els.eFighter.classList.add('shake');
        setTimeout(() => {
            els.eAvatar.classList.remove('shake');
            els.eFighter.classList.remove('shake');
        }, 600);
      }
      updateUI();

      if (state.playerHealth <= 0) endGame(false);
      else if (state.enemyHealth <= 0) endGame(true);
    }

    function updateStats() {
      els.score.textContent = state.score;
      if (state.combo > 1) {
        els.comboPill.style.display = 'flex';
        els.comboVal.textContent = state.combo;
      } else {
        els.comboPill.style.display = 'none';
      }
    }

    function updateUI() {
      els.pHealth.style.width = state.playerHealth + '%';
      els.eHealth.style.width = state.enemyHealth + '%';
      els.pHealth.className = `health-fill ${state.playerHealth <= 25 ? 'low' : ''}`;
      els.eHealth.className = `health-fill ${state.enemyHealth <= 20 ? 'low' : ''}`;
    }

    function endGame(win) {
      state.roundActive = false;
      els.overlay.classList.add('visible');
      els.finalScore.textContent = state.score;
      if (win) {
        els.endTitle.textContent = "BOT DEFEATED! 🤖";
        els.endTitle.style.color = "var(--green)";
        els.taunt.textContent = "Impossible. You are truly heartless.";
      } else {
        els.endTitle.textContent = "YOU CRACKED! 😂";
        els.endTitle.style.color = "var(--red)";
        els.taunt.textContent = taunts[Math.floor(Math.random() * taunts.length)];
      }
    }

    async function fetchJoke() {
      state.roundActive = true;
      state.laughDetected = false;
      state.isListening = false;
      detector.setListening(false);

      els.micDot.classList.remove('active');
      els.nextBtn.disabled = true;
      els.nextBtn.textContent = "Calculating Humor...";

      els.pAvatar.textContent = "😐";
      els.eAvatar.textContent = "🤡";
      els.status.style.color = "var(--muted)";
      els.status.textContent = "Bot is searching its database...";

      els.setup.textContent = "Wait for it...";
      els.punchline.textContent = "";
      els.punchline.classList.remove('visible');

      try {
        const res = await fetch(WORKER_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "get_joke",
            avoid: state.seenJokes.slice(-15)
          })
        });

        const data = await res.json();
        const raw = data.raw || "";

        let setup = "Unknown";
        let punchline = "...";
        const split = raw.toUpperCase().lastIndexOf("PUNCHLINE:");

        if (split !== -1) {
          setup = raw.substring(0, split).replace(/SETUP:/i, '').trim();
          punchline = raw.substring(split).replace(/PUNCHLINE:/i, '').trim();
        } else {
          setup = raw;
        }

        state.seenJokes.push(setup);
        els.setup.textContent = setup;

        // Delivery Timing
        setTimeout(() => {
          AudioEngine.tick();
          els.punchline.textContent = punchline;
          els.punchline.classList.add('visible');
          els.eAvatar.textContent = "😜";

          // START LISTENING
          state.isListening = true;
          detector.setListening(true);
          els.micDot.classList.add('active');
          els.status.textContent = "DON'T LAUGH! 🎙️ LISTENING...";

          els.eFighter.classList.add('active');

          setTimeout(() => {
            els.eFighter.classList.remove('active');
            if (!state.laughDetected && state.isListening) {
              botFailed();
            }
          }, 6000); // 6 seconds to survive

        }, 3000);

      } catch (e) {
        console.error(e);
        els.setup.textContent = "Connection lost to the Comedy Cloud.";
        els.nextBtn.disabled = false;
        els.nextBtn.textContent = "Retry Connection 🔄";
      }
    }

    els.startBtn.addEventListener('click', initGame);
    els.nextBtn.addEventListener('click', fetchJoke);
