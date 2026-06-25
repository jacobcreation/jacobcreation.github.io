    const WORKER_URL = "https://riddle-ai.b4rjxr9lk.workers.dev/";

    // State
    let level = 1;
    let playerHealth = 100;
    let enemyHealth = 100;
    let currentRiddle = "";
    let currentAnswer = "";
    let seenAnswers = []; // Track past answers to avoid repeats
    let wrongAttempts = 0; // Track wrong guesses per riddle
    let isProcessing = false;

    // Elements
    const els = {
      level: document.getElementById('level-display'),
      pHealth: document.getElementById('player-health'),
      eHealth: document.getElementById('enemy-health'),
      pAvatar: document.getElementById('player-avatar'),
      eAvatar: document.getElementById('enemy-avatar'),
      riddle: document.getElementById('riddle-text'),
      status: document.getElementById('status-msg'),
      inputArea: document.getElementById('input-area'),
      input: document.getElementById('answer-input'),
      submit: document.getElementById('submit-btn'),
      startBtn: document.getElementById('start-btn'),
      card: document.getElementById('game-card'),
      overlay: document.getElementById('overlay'),
      overlayTitle: document.getElementById('overlay-title'),
      overlayMsg: document.getElementById('overlay-msg'),
      nextBtn: document.getElementById('next-level-btn'),
      restartBtn: document.getElementById('restart-btn')
    };

    // --- GAME LOGIC ---

    function updateHealthUI() {
      els.pHealth.style.width = playerHealth + '%';
      els.eHealth.style.width = enemyHealth + '%';

      // Color changes
      els.pHealth.className = `health-fill ${playerHealth < 40 ? 'low' : playerHealth < 70 ? 'med' : ''}`;
      els.eHealth.className = `health-fill ${enemyHealth < 40 ? 'low' : enemyHealth < 70 ? 'med' : ''}`;
    }

    function takeDamage(target) {
      if (target === 'player') {
        playerHealth = Math.max(0, playerHealth - 10); // 10 mistakes = game over
        els.pAvatar.classList.add('shake');
        setTimeout(() => els.pAvatar.classList.remove('shake'), 500);
      } else {
        enemyHealth = Math.max(0, enemyHealth - 10); // 10 correct = win level
        els.eAvatar.classList.add('shake');
        setTimeout(() => els.eAvatar.classList.remove('shake'), 500);
      }
      updateHealthUI();
      checkWinCondition();
    }

    function checkWinCondition() {
      if (playerHealth <= 0) {
        showGameOver(false);
      } else if (enemyHealth <= 0) {
        showGameOver(true);
      } else {
        // Continue game - fetch new riddle if the enemy was hit but not dead?
        // Actually, let's fetch a NEW riddle after every correct answer to keep fighting
        if (enemyHealth > 0 && playerHealth > 0) {
          // If we just hit the enemy, get the next riddle immediately
          // If we got hit, we can retry the SAME riddle
        }
      }
    }

    function showGameOver(isWin) {
      els.overlay.classList.add('visible');
      if (isWin) {
        els.overlayTitle.textContent = "VICTORY!";
        els.overlayTitle.className = "game-over-title win-text";
        els.overlayMsg.textContent = `You defeated the Level ${level} Bot!`;
        els.nextBtn.style.display = "inline-flex";
        els.restartBtn.style.display = "none";
      } else {
        els.overlayTitle.textContent = "DEFEATED";
        els.overlayTitle.className = "game-over-title lose-text";
        els.overlayMsg.textContent = "The Bot outsmarted you.";
        els.nextBtn.style.display = "none";
        els.restartBtn.style.display = "inline-flex";
      }
    }

    async function fetchRiddle() {
      if (isProcessing) return;
      isProcessing = true;

      const loadingMessages = [
        "Bot is thinking...",
        "Consulting the oracle...",
        "Reading ancient scrolls...",
        "Calculus is hard...",
        "Parsing the universe...",
        "Generating wit...",
        "Almost there..."
      ];
      let msgIdx = 0;

      els.card.classList.add('loading');
      els.riddle.textContent = loadingMessages[0];
      els.status.textContent = "";
      els.inputArea.classList.add('hidden');
      els.startBtn.style.display = "none";

      // Rotate messages every 2 seconds
      const loadingInterval = setInterval(() => {
        msgIdx = (msgIdx + 1) % loadingMessages.length;
        els.riddle.textContent = loadingMessages[msgIdx];
      }, 2000);

      // Randomize the request to prevent duplicates
      const themes = ["Animals", "Space", "Food", "Time", "Nature", "Household Objects", "Logic", "Words", "Mystery", "History", "Science"];
      const randomTheme = themes[Math.floor(Math.random() * themes.length)];

      // 20 Second Timeout (Increased slightly as 13s is common)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      try {
        const res = await fetch(WORKER_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            action: "get_riddle",
            level: level,
            theme: randomTheme,
            avoid: seenAnswers.slice(-10)
          })
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          throw new Error(`Server returned ${res.status}`);
        }

        // Parse JSON response
        const data = await res.json().catch(() => {
          throw new Error("Worker returned invalid format. Did you update the worker code?");
        });

        const rawText = data.raw || "";
        let rText = "Could not parse riddle.";
        let aText = "";

        const upper = rawText.toUpperCase();
        const answerIndex = upper.lastIndexOf("ANSWER:");

        if (answerIndex !== -1) {
          rText = rawText.substring(0, answerIndex).replace(/RIDDLE:/i, '').trim();
          aText = rawText.substring(answerIndex).replace(/ANSWER:/i, '').trim();
        } else {
          rText = rawText;
          aText = "unknown";
          console.warn("Worker didn't return RIDDLE/ANSWER format:", rawText);
        }

        currentRiddle = rText;
        currentAnswer = aText;
        wrongAttempts = 0; // Reset wrong attempts for new riddle

        els.riddle.innerHTML = currentRiddle;
        els.riddle.classList.remove('placeholder');
        els.inputArea.classList.remove('hidden');
        els.input.value = "";
        els.input.focus();
        els.input.disabled = false;
        els.submit.disabled = true;

        // Answer hidden from console to prevent cheating
        // console.log("Answer Key:", currentAnswer);

      } catch (e) {
        console.error(e);
        if (e.name === 'AbortError') {
          els.riddle.textContent = "Request timed out. The Bot is asleep.";
        } else {
          els.riddle.textContent = `Error: ${e.message}`;
        }
        els.startBtn.style.display = "inline-block"; // Allow retry
        els.startBtn.textContent = "🔄 Retry";

      } finally {
        els.card.classList.remove('loading');
        isProcessing = false;
        clearTimeout(timeoutId);
        clearInterval(loadingInterval);
      }
    }

    async function checkAnswer() {
      const userAns = els.input.value.trim();
      if (!userAns) return;

      // LOCAL CHECK (Instant)
      // We check if:
      // 1. User answer is inside correct answer (e.g. "Piano" in "Use a Piano")
      // 2. Correct answer is inside user answer
      // 3. Exact match

      const cleanUser = userAns.toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanKey = currentAnswer.toLowerCase().replace(/[^a-z0-9]/g, '');

      // Basic validation to avoid empty matches
      if (cleanUser.length < 2) return;

      let isCorrect = false;
      if (cleanKey.includes(cleanUser) || cleanUser.includes(cleanKey)) {
        isCorrect = true;
      }

      // Extra check: edit distance could be added here later

      if (isCorrect) {
        els.status.textContent = "CRITICAL HIT! 💥";
        els.status.style.color = "var(--green)";
        takeDamage('enemy');

        seenAnswers.push(currentAnswer); // Remember this answer

        if (enemyHealth > 0) {
          els.input.disabled = true;
          els.submit.disabled = true;
          setTimeout(() => {
            els.status.textContent = "Next riddle coming...";
            setTimeout(fetchRiddle, 1000);
          }, 1000);
        }
      } else {
        els.status.textContent = "WRONG! YOU TAKE DAMAGE! 🛡️";
        els.status.style.color = "var(--red)";
        takeDamage('player');

        wrongAttempts++;

        if (playerHealth > 0) {

          // 3 Wrong Guesses -> Reveal Answer
          if (wrongAttempts >= 3) {
            els.status.textContent = `Too hard! Answer was: ${currentAnswer}`;
            els.input.disabled = true;
            els.submit.disabled = true;

            // Move to next riddle automatically
            setTimeout(() => {
              els.status.textContent = "Next riddle coming...";
              setTimeout(fetchRiddle, 2000);
            }, 2500); // Give user time to read answer

          } else {
            // Just let them retry
            els.input.value = "";
            els.input.focus();
            els.input.classList.add('shake');
            setTimeout(() => els.input.classList.remove('shake'), 500);
          }
        }
      }
    }

    // Controls
    els.startBtn.addEventListener('click', () => {
      fetchRiddle();
    });

    els.input.addEventListener('input', () => {
      els.submit.disabled = els.input.value.trim().length === 0;
    });

    els.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !els.submit.disabled) checkAnswer();
    });
    els.submit.addEventListener('click', checkAnswer);

    // Level Managment
    els.nextBtn.addEventListener('click', () => {
      level++;
      els.level.textContent = level;
      resetGame();
    });

    els.restartBtn.addEventListener('click', () => {
      resetGame(); // Keep same level
    });

    function resetGame() {
      playerHealth = 100;
      enemyHealth = 100;
      updateHealthUI();
      els.overlay.classList.remove('visible');
      fetchRiddle();
    }

    // Init Visuals
    updateHealthUI();
