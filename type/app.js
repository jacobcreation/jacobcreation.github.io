        const WORKER_URL = "https://typing-game-worker.b4rjxr9lk.workers.dev";
        const viewport = document.getElementById("game-viewport");
        const mainInput = document.getElementById("main-input");
        const pointsEl = document.getElementById("points-display");
        const wpmEl = document.getElementById("wpm-display");
        const accuracyEl = document.getElementById("accuracy-display");
        const missedEl = document.getElementById("missed-display");
        const gameOverOverlay = document.getElementById("game-over-overlay");
        const startBtn = document.getElementById("start-btn");
        const activeSpellsContainer = document.getElementById("active-spells");

        // Game State
        let state = {
            wordsList: [],
            activeWords: [],
            startTime: null,
            typedChars: 0,
            correctChars: 0,
            missedCount: 0,
            points: 0,
            gameEnded: true,
            difficulty: 1,
            inventory: {
                ice: 0,
                fire: 0,
                shield: 0,
                time: 0
            },
            spellsActive: {
                frozen: false,
                slow: false,
                shield: 0
            },
            fallInterval: null,
            spawnTimer: 0,
            isFetching: false
        };

        // Spell Configs
        const SPELLS = {
            ice: {
                cost: 25,
                duration: 4000,
                color: '#00d2ff'
            },
            fire: {
                cost: 50,
                duration: 0,
                color: '#ff4b2b'
            },
            shield: {
                cost: 35,
                duration: Infinity,
                color: '#ffcc33'
            },
            time: {
                cost: 30,
                duration: 8000,
                color: '#9d50bb'
            }
        };

        async function startGame() {
            
            // Reset State
            state = {
                wordsList: [],
                activeWords: [],
                startTime: Date.now(),
                typedChars: 0,
                correctChars: 0,
                missedCount: 0,
                points: state.points, // Keep points from previous run if any? User said "buy spells with points", so maybe persistent or zero? Usually games reset. Let's keep persistent points for a better "meta" feel.
                gameEnded: false,
                difficulty: 1,
                inventory: state.inventory,
                spellsActive: {
                    frozen: false,
                    slow: false,
                    shield: 0
                },
                fallInterval: null,
                spawnTimer: 0,
                isFetching: false
            };

            // UI Reset
            viewport.querySelectorAll('.word').forEach(w => w.remove());
            gameOverOverlay.style.display = 'none';
            startBtn.style.display = 'none';
            mainInput.value = '';
            mainInput.focus();
            updateUI();

            await refillWords();

            if (state.fallInterval) clearInterval(state.fallInterval);
            state.fallInterval = setInterval(gameLoop, 20);
        }

        function gameLoop() {
            if (state.gameEnded) return;

            // Handle Spawning
            state.spawnTimer += 20;
            const spawnRate = Math.max(500, 2000 - (state.difficulty * 100));

            if (state.wordsList.length < 15) {
                refillWords();
            }

            if (state.spawnTimer > spawnRate && state.wordsList.length > 0) {
                spawnWord();
                state.spawnTimer = 0;
                state.difficulty += 0.05;
            }

            // Handle Movement
            if (!state.spellsActive.frozen) {
                const elapsed = (Date.now() - state.startTime) / 1000;
                let speedMult = Math.min(5, 1 + (elapsed * 0.02));
                if (state.spellsActive.slow) speedMult *= 0.4;

                state.activeWords.forEach((w, i) => {
                    let top = parseFloat(w.div.style.top || 0);
                    top += (1.5 * speedMult);
                    w.div.style.top = top + "px";

                    if (top > viewport.offsetHeight - 40) {
                        handleMiss(w, i);
                    }
                });
            }

            updateWPM();
        }

        function spawnWord() {
            const word = state.wordsList.shift();
            const div = document.createElement("div");
            div.className = "word";
            div.textContent = word;
            div.style.left = Math.random() * (viewport.offsetWidth - 150) + 50 + "px";
            div.style.top = "-30px";
            viewport.appendChild(div);
            state.activeWords.push({
                div,
                word
            });
        }

        function handleMiss(wordObj, index) {
            if (state.spellsActive.shield > 0) {
                state.spellsActive.shield--;
                explodeWord(wordObj.div);
                state.activeWords.splice(index, 1);
                updateUI();
                return;
            }

            viewport.removeChild(wordObj.div);
            state.activeWords.splice(index, 1);
            state.missedCount++;
            updateUI();
            checkGameOver();
        }

        function checkGameOver() {
            if (state.missedCount >= 10) {
                state.gameEnded = true;
                clearInterval(state.fallInterval);
                gameOverOverlay.style.display = 'flex';
                startBtn.style.display = 'block';
            }
        }

        mainInput.addEventListener("input", () => {
            if (state.gameEnded) return;

            const typed = mainInput.value.trim();
            if (!typed) return;

            state.typedChars++;

            // Clean function to remove dots and commas for comparison
            const clean = (str) => str.toLowerCase().replace(/[.,]/g, '');
            const cleanTyped = clean(typed);

            for (let i = 0; i < state.activeWords.length; i++) {
                const targetWord = state.activeWords[i].word;
                if (clean(targetWord) === cleanTyped) {
                    // Success!
                    state.correctChars += targetWord.length;
                    state.points += 5;
                    explodeWord(state.activeWords[i].div);
                    state.activeWords.splice(i, 1);
                    mainInput.value = "";
                    updateUI();
                    break;
                }
            }
        });

        function explodeWord(div) {
            div.classList.add('exploding');
            setTimeout(() => {
                if (div.parentNode) div.parentNode.removeChild(div);
            }, 400);
        }

        function updateUI() {
            pointsEl.textContent = Math.floor(state.points);
            accuracyEl.textContent = state.typedChars ? Math.round((state.correctChars / state.typedChars) * 100) : 0 + "%";
            missedEl.innerHTML = `${state.missedCount}<span style="font-size: 0.8rem; color: #666">/10</span>`;

            // Update Inventory
            for (const [key, count] of Object.entries(state.inventory)) {
                document.querySelector(`#inv-${key} .inv-count`).textContent = count;
            }

            // Update Active Spells Tags
            activeSpellsContainer.innerHTML = '';
            if (state.spellsActive.frozen) {
                addSpellTag('FROZEN', '#00d2ff');
            }
            if (state.spellsActive.slow) {
                addSpellTag('TIME WARP', '#9d50bb');
            }
            if (state.spellsActive.shield > 0) {
                addSpellTag(`SHIELD: <span class="shield-count">${state.spellsActive.shield}</span>`, '#ffcc33');
            }
        }

        function addSpellTag(text, color) {
            const tag = document.createElement('div');
            tag.className = 'spell-tag';
            tag.style.background = color + '44';
            tag.style.border = `1px solid ${color}`;
            tag.style.color = color;
            tag.innerHTML = text;
            activeSpellsContainer.appendChild(tag);
        }

        function updateWPM() {
            if (!state.startTime) return;
            const mins = (Date.now() - state.startTime) / 60000;
            const wpm = mins > 0 ? Math.round((state.correctChars / 5) / mins) : 0;
            wpmEl.textContent = wpm;
        }

        // Spell Logic
        function buySpell(type, e) {
            const cost = SPELLS[type].cost;
            if (state.points >= cost) {
                state.points -= cost;
                state.inventory[type]++;
                updateUI();
                // Visual feedback on click
                if (e && e.currentTarget) {
                    const target = e.currentTarget;
                    target.style.transform = 'scale(0.95)';
                    setTimeout(() => {
                        target.style.transform = '';
                    }, 100);
                }
            } else {
                alert("Not enough points!");
            }
        }

        function castSpell(type) {
            if (state.inventory[type] <= 0 || state.gameEnded) return;

            state.inventory[type]--;
            const config = SPELLS[type];

            switch (type) {
                case 'ice':
                    state.spellsActive.frozen = true;
                    document.querySelectorAll('.word').forEach(w => w.classList.add('frozen'));
                    setTimeout(() => {
                        state.spellsActive.frozen = false;
                        document.querySelectorAll('.word').forEach(w => w.classList.remove('frozen'));
                        updateUI();
                    }, config.duration);
                    break;
                case 'fire':
                    state.activeWords.forEach(w => explodeWord(w.div));
                    state.activeWords = [];
                    break;
                case 'shield':
                    state.spellsActive.shield += 3;
                    break;
                case 'time':
                    state.spellsActive.slow = true;
                    setTimeout(() => {
                        state.spellsActive.slow = false;
                        updateUI();
                    }, config.duration);
                    break;
            }
            updateUI();
        }

        async function refillWords() {
            if (state.isFetching || state.gameEnded) return;
            state.isFetching = true;
            try {
                const res = await fetch(WORKER_URL);
                const data = await res.json();
                const newWords = data.text.split(" ").filter(w => w.length > 2);
                state.wordsList.push(...newWords);
            } catch (e) {
                console.warn("Failed to fetch words, using fallbacks");
                const fallback = ["magic", "spell", "arcane", "mystic", "typing", "victory", "defeat", "legend", "frost", "ember", "scroll", "potion", "wizard", "dragon", "knight", "castle", "shadow", "light", "spirit", "ancient", "alchemy", "enchant", "grimoire", "staff", "wand", "relic", "golem", "portal", "void", "ethereal"];
                state.wordsList.push(...fallback.sort(() => Math.random() - 0.5));
            } finally {
                state.isFetching = false;
            }
        }

        // keyboard listeners
        window.addEventListener('keydown', (e) => {
            if (e.key === '1') castSpell('ice');
            if (e.key === '2') castSpell('fire');
            if (e.key === '3') castSpell('shield');
            if (e.key === '4') castSpell('time');
        });
