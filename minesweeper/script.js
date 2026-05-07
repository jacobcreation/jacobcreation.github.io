class Minesweeper {
	constructor() {
		this.board = document.getElementById("game-board");
		this.mineCountDisplay = document.getElementById("mine-count");
		this.timerDisplay = document.getElementById("timer");
		this.difficultySelect = document.getElementById("difficulty");
		this.newGameBtn = document.getElementById("new-game-btn");
		this.gameStatus = document.getElementById("game-status");
		this.customSettings = document.getElementById("custom-settings");

		this.difficulties = {
			beginner: { width: 9, height: 9, mines: 10 },
			intermediate: { width: 16, height: 16, mines: 40 },
			expert: { width: 30, height: 16, mines: 99 },
		};

		this.width = 9;
		this.height = 9;
		this.mines = 10;
		this.cells = [];
		this.mineLocations = new Set();
		this.revealedCount = 0;
		this.flags = 0;
		this.isGameOver = false;
		this.isFirstClick = true;
		this.timer = null;
		this.seconds = 0;
		this.isFlagMode = false;

		// Audio
		this.audioCtx = null;
		this.longPressTimer = null;
		this.isLongPress = false;

		this.init();
	}

	init() {
		this.difficultySelect.addEventListener("change", () => {
			if (this.difficultySelect.value === "custom") {
				this.customSettings.classList.remove("hidden");
			} else {
				this.customSettings.classList.add("hidden");
				const { width, height, mines } =
					this.difficulties[this.difficultySelect.value];
				this.width = width;
				this.height = height;
				this.mines = mines;
				this.startNewGame();
			}
		});

		this.newGameBtn.addEventListener("click", () => this.startNewGame());

		this.toggleFlagBtn = document.getElementById("toggle-flag");
		if (this.toggleFlagBtn) {
			this.toggleFlagBtn.addEventListener("click", () => this.toggleFlagMode());
		}

		this.board.addEventListener("contextmenu", (e) => {
			e.preventDefault();
		});

		// Custom inputs
		["custom-width", "custom-height", "custom-mines"].forEach((id) => {
			const input = document.getElementById(id);
			if (input) {
				input.addEventListener("change", () => {
					if (this.difficultySelect.value === "custom") {
						this.width = parseInt(
							document.getElementById("custom-width").value,
						);
						this.height = parseInt(
							document.getElementById("custom-height").value,
						);
						this.mines = parseInt(
							document.getElementById("custom-mines").value,
						);
						// Sanitize
						this.width = Math.max(5, Math.min(50, this.width));
						this.height = Math.max(5, Math.min(50, this.height));
						this.mines = Math.max(
							1,
							Math.min(this.width * this.height - 1, this.mines),
						);
						this.startNewGame();
					}
				});
			}
		});

		this.renderHighScores();
		this.startNewGame();
	}

	toggleFlagMode(force = null) {
		this.isFlagMode = force !== null ? force : !this.isFlagMode;
		if (this.toggleFlagBtn) {
			if (this.isFlagMode) {
				this.toggleFlagBtn.classList.add("active");
				this.toggleFlagBtn.innerHTML = '<span class="icon">🚩</span> Flag Mode';
			} else {
				this.toggleFlagBtn.classList.remove("active");
				this.toggleFlagBtn.innerHTML =
					'<span class="icon">🔍</span> Reveal Mode';
			}
		}
	}

	initAudio() {
		if (!this.audioCtx) {
			this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
		}
	}

	playSound(type) {
		if (!this.audioCtx) return;
		const oscillator = this.audioCtx.createOscillator();
		const gainNode = this.audioCtx.createGain();

		oscillator.connect(gainNode);
		gainNode.connect(this.audioCtx.destination);

		const now = this.audioCtx.currentTime;

		if (type === "reveal") {
			oscillator.type = "sine";
			oscillator.frequency.setValueAtTime(440, now);
			oscillator.frequency.exponentialRampToValueAtTime(880, now + 0.1);
			gainNode.gain.setValueAtTime(0.1, now);
			gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
			oscillator.start();
			oscillator.stop(now + 0.1);
		} else if (type === "flag") {
			oscillator.type = "triangle";
			oscillator.frequency.setValueAtTime(220, now);
			gainNode.gain.setValueAtTime(0.1, now);
			gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
			oscillator.start();
			oscillator.stop(now + 0.1);
		} else if (type === "explosion") {
			oscillator.type = "sawtooth";
			oscillator.frequency.setValueAtTime(100, now);
			oscillator.frequency.exponentialRampToValueAtTime(40, now + 0.5);
			gainNode.gain.setValueAtTime(0.3, now);
			gainNode.gain.linearRampToValueAtTime(0, now + 0.5);
			oscillator.start();
			oscillator.stop(now + 0.5);
		} else if (type === "win") {
			oscillator.type = "square";
			[523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
				const osc = this.audioCtx.createOscillator();
				const gn = this.audioCtx.createGain();
				osc.connect(gn);
				gn.connect(this.audioCtx.destination);
				osc.frequency.setValueAtTime(freq, now + i * 0.1);
				gn.gain.setValueAtTime(0.1, now + i * 0.1);
				gn.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.2);
				osc.start(now + i * 0.1);
				osc.stop(now + i * 0.1 + 0.2);
			});
		}
	}

	startNewGame() {
		this.stopTimer();
		this.seconds = 0;
		this.timerDisplay.textContent = "000";
		this.isGameOver = false;
		this.isFirstClick = true;
		this.revealedCount = 0;
		this.flags = 0;
		this.mineLocations.clear();
		this.gameStatus.textContent = "";
		this.updateMineCount();
		this.createBoard();
		this.toggleFlagMode(false);
	}

	createBoard() {
		this.board.innerHTML = "";
		this.board.style.gridTemplateColumns = `repeat(${this.width}, var(--cell-size))`;
		this.cells = [];

		for (let y = 0; y < this.height; y++) {
			for (let x = 0; x < this.width; x++) {
				const cell = document.createElement("div");
				cell.classList.add("cell");
				cell.dataset.x = x;
				cell.dataset.y = y;

				// Mouse events
				cell.addEventListener("mousedown", (e) => {
					this.initAudio();
					if (e.button === 0) {
						// Left
						this.isLongPress = false;
						this.longPressTimer = setTimeout(() => {
							this.isLongPress = true;
							this.handleRightClick(x, y);
						}, 500);
					} else if (e.button === 1) {
						// Middle
						e.preventDefault();
						this.handleChord(x, y);
					}
				});

				cell.addEventListener("mouseup", (e) => {
					if (this.longPressTimer) {
						clearTimeout(this.longPressTimer);
						this.longPressTimer = null;
						if (e.button === 0 && !this.isLongPress) {
							if (this.isFlagMode) this.handleRightClick(x, y);
							else this.handleLeftClick(x, y);
						}
					}
				});

				cell.addEventListener("mouseleave", () => {
					if (this.longPressTimer) {
						clearTimeout(this.longPressTimer);
						this.longPressTimer = null;
					}
				});

				cell.addEventListener("contextmenu", (e) => {
					e.preventDefault();
					this.handleRightClick(x, y);
				});

				cell.addEventListener("dblclick", () => this.handleChord(x, y));

				// Touch events
				cell.addEventListener(
					"touchstart",
					(e) => {
						this.initAudio();
						this.isLongPress = false;
						this.longPressTimer = setTimeout(() => {
							this.isLongPress = true;
							this.toggleFlagMode();
							if (navigator.vibrate) navigator.vibrate(50);
						}, 500);
					},
					{ passive: true },
				);

				cell.addEventListener("touchend", (e) => {
					if (this.longPressTimer) {
						clearTimeout(this.longPressTimer);
						this.longPressTimer = null;
						if (!this.isLongPress) {
							if (this.isFlagMode) this.handleRightClick(x, y);
							else this.handleLeftClick(x, y);
						}
					}
				});

				this.board.appendChild(cell);
				this.cells.push({
					x,
					y,
					element: cell,
					isMine: false,
					isRevealed: false,
					isFlagged: false,
					neighborMines: 0,
				});
			}
		}
	}

	getCell(x, y) {
		if (x < 0 || x >= this.width || y < 0 || y >= this.height) return null;
		return this.cells[y * this.width + x];
	}

	placeMines(firstX, firstY) {
		let placed = 0;
		while (placed < this.mines) {
			const x = Math.floor(Math.random() * this.width);
			const y = Math.floor(Math.random() * this.height);
			const key = `${x},${y}`;

			if (Math.abs(x - firstX) <= 1 && Math.abs(y - firstY) <= 1) continue;

			if (!this.mineLocations.has(key)) {
				this.mineLocations.add(key);
				this.getCell(x, y).isMine = true;
				placed++;
			}
		}

		this.cells.forEach((cell) => {
			if (!cell.isMine) {
				cell.neighborMines = this.getNeighbors(cell.x, cell.y).filter(
					(n) => n.isMine,
				).length;
			}
		});
	}

	getNeighbors(x, y) {
		const neighbors = [];
		for (let dy = -1; dy <= 1; dy++) {
			for (let dx = -1; dx <= 1; dx++) {
				if (dx === 0 && dy === 0) continue;
				const neighbor = this.getCell(x + dx, y + dy);
				if (neighbor) neighbors.push(neighbor);
			}
		}
		return neighbors;
	}

	handleLeftClick(x, y) {
		if (this.isGameOver) return;
		const cell = this.getCell(x, y);
		if (cell.isFlagged || cell.isRevealed) return;

		if (this.isFirstClick) {
			this.isFirstClick = false;
			this.placeMines(x, y);
			this.startTimer();
		}

		if (cell.isMine) {
			this.gameOver(false, cell);
		} else {
			this.revealCell(cell);
			if (this.revealedCount === this.width * this.height - this.mines) {
				this.gameOver(true);
			}
		}
	}

	handleRightClick(x, y) {
		if (this.isGameOver) return;
		const cell = this.getCell(x, y);
		if (cell.isRevealed) return;

		cell.isFlagged = !cell.isFlagged;
		if (cell.isFlagged) {
			cell.element.classList.add("flagged");
			cell.element.textContent = "🚩";
			this.flags++;
			this.playSound("flag");
		} else {
			cell.element.classList.remove("flagged");
			cell.element.textContent = "";
			this.flags--;
		}
		this.updateMineCount();
	}

	handleChord(x, y) {
		if (this.isGameOver) return;
		const cell = this.getCell(x, y);
		if (!cell.isRevealed || cell.neighborMines === 0) return;

		const neighbors = this.getNeighbors(x, y);
		const flaggedNeighbors = neighbors.filter((n) => n.isFlagged).length;

		if (flaggedNeighbors === cell.neighborMines) {
			neighbors.forEach((n) => {
				if (!n.isRevealed && !n.isFlagged) {
					this.handleLeftClick(n.x, n.y);
				}
			});
		}
	}

	revealCell(cell) {
		if (cell.isRevealed || cell.isFlagged) return;

		cell.isRevealed = true;
		cell.element.classList.add("revealed");
		this.revealedCount++;
		this.playSound("reveal");

		if (cell.neighborMines > 0) {
			cell.element.textContent = cell.neighborMines;
			cell.element.dataset.count = cell.neighborMines;
		} else {
			this.getNeighbors(cell.x, cell.y).forEach((n) => this.revealCell(n));
		}
	}

	gameOver(isWin, clickedMine = null) {
		this.isGameOver = true;
		this.stopTimer();

		if (isWin) {
			this.gameStatus.textContent = "😎 YOU WIN!";
			this.gameStatus.style.color = "var(--blue)";
			this.playSound("win");
			this.saveScore();
			this.createConfetti();
			// Flag remaining mines
			this.cells.forEach((cell) => {
				if (cell.isMine && !cell.isFlagged) {
					cell.element.classList.add("flagged");
					cell.element.textContent = "🚩";
				}
			});
		} else {
			this.gameStatus.textContent = "💥 GAME OVER!";
			this.gameStatus.style.color = "var(--red)";
			this.playSound("explosion");
			if (clickedMine) clickedMine.element.classList.add("mine");

			this.cells.forEach((cell) => {
				if (cell.isMine) {
					cell.element.classList.add("revealed");
					if (!cell.isFlagged) cell.element.textContent = "💣";
				} else if (cell.isFlagged) {
					cell.element.textContent = "❌";
				}
			});
		}
	}

	createConfetti() {
		for (let i = 0; i < 100; i++) {
			const confetti = document.createElement("div");
			confetti.classList.add("confetti");
			confetti.style.left = Math.random() * 100 + "vw";
			confetti.style.animationDelay = Math.random() * 2 + "s";
			confetti.style.backgroundColor = `hsl(${Math.random() * 360}, 100%, 50%)`;
			document.body.appendChild(confetti);
			setTimeout(() => confetti.remove(), 4000);
		}
	}

	startTimer() {
		if (this.timer) clearInterval(this.timer);
		this.timer = setInterval(() => {
			this.seconds++;
			this.timerDisplay.textContent = this.seconds.toString().padStart(3, "0");
			if (this.seconds >= 999) this.stopTimer();
		}, 1000);
	}

	stopTimer() {
		clearInterval(this.timer);
		this.timer = null;
	}

	updateMineCount() {
		const remaining = this.mines - this.flags;
		this.mineCountDisplay.textContent = remaining.toString().padStart(3, "0");
	}

	saveScore() {
		const difficulty = this.difficultySelect.value;
		if (difficulty === "custom") return;

		const scores = JSON.parse(
			localStorage.getItem("minesweeper_scores") || "{}",
		);
		if (!scores[difficulty] || this.seconds < scores[difficulty]) {
			scores[difficulty] = this.seconds;
			localStorage.setItem("minesweeper_scores", JSON.stringify(scores));
			this.renderHighScores();
		}
	}

	renderHighScores() {
		const scores = JSON.parse(
			localStorage.getItem("minesweeper_scores") || "{}",
		);
		const container =
			document.getElementById("high-scores") || document.createElement("div");
		container.id = "high-scores";
		container.innerHTML = "<h3>🏆 Best Times</h3>";

		Object.entries(this.difficulties).forEach(([diff, _]) => {
			const time = scores[diff] ? `${scores[diff]}s` : "---";
			container.innerHTML += `<div class="score-entry"><span>${diff.charAt(0).toUpperCase() + diff.slice(1)}:</span> <span>${time}</span></div>`;
		});

		const footer = document.querySelector(".game-footer");
		if (!document.getElementById("high-scores")) {
			footer.appendChild(container);
		}
	}
}

window.addEventListener("DOMContentLoaded", () => {
	new Minesweeper();
});
