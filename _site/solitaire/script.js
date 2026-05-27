/**
 * Solitaire Game - Klondike
 * Styled for JacobCreation
 */

const SUITS = ["hearts", "diamonds", "clubs", "spades"];
const VALUES = [
	"A",
	"2",
	"3",
	"4",
	"5",
	"6",
	"7",
	"8",
	"9",
	"10",
	"J",
	"Q",
	"K",
];
const SUIT_ICONS = { hearts: "♥", diamonds: "♦", clubs: "♣", spades: "♠" };

class Card {
	constructor(suit, value, faceUp = false) {
		this.suit = suit;
		this.value = value;
		this.faceUp = faceUp;
		this.rank = VALUES.indexOf(value) + 1;
		this.color = suit === "hearts" || suit === "diamonds" ? "red" : "black";
	}

	get id() {
		return `${this.value}-${this.suit}`;
	}

	render() {
		const cardEl = document.createElement("div");
		cardEl.className = `card ${this.color} ${this.faceUp ? "" : "face-down"}`;
		cardEl.id = this.id;
		cardEl.draggable = this.faceUp;

		if (this.faceUp) {
			cardEl.innerHTML = `
                <div class="card-value">${this.value}</div>
                <div class="card-suit">${SUIT_ICONS[this.suit]}</div>
                <div class="card-center-suit">${SUIT_ICONS[this.suit]}</div>
            `;
		}

		return cardEl;
	}
}

class Game {
	constructor() {
		this.deck = [];
		this.piles = {
			stock: [],
			waste: [],
			foundation: [[], [], [], []],
			tableau: [[], [], [], [], [], [], []],
		};
		this.score = 0;
		this.moves = 0;
		this.timer = 0;
		this.timerInterval = null;
		this.history = [];

		this.init();
	}

	init() {
		this.createDeck();
		this.shuffleDeck();
		this.deal();
		this.render();
		this.setupEventListeners();
		this.startTimer();
	}

	createDeck() {
		this.deck = [];
		SUITS.forEach((suit) => {
			VALUES.forEach((value) => {
				this.deck.push(new Card(suit, value));
			});
		});
	}

	shuffleDeck() {
		for (let i = this.deck.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
		}
	}

	deal() {
		// Reset piles
		this.piles.stock = [];
		this.piles.waste = [];
		this.piles.foundation = [[], [], [], []];
		this.piles.tableau = [[], [], [], [], [], [], []];

		// Deal to tableau
		for (let i = 0; i < 7; i++) {
			for (let j = i; j < 7; j++) {
				const card = this.deck.pop();
				if (i === j) card.faceUp = true;
				this.piles.tableau[j].push(card);
			}
		}

		// Remaining to stock
		this.piles.stock = this.deck;
	}

	startTimer() {
		clearInterval(this.timerInterval);
		this.timer = 0;
		this.timerInterval = setInterval(() => {
			this.timer++;
			const minutes = Math.floor(this.timer / 60)
				.toString()
				.padStart(2, "0");
			const seconds = (this.timer % 60).toString().padStart(2, "0");
			document.getElementById("timer").textContent = `${minutes}:${seconds}`;
		}, 1000);
	}

	saveState() {
		const state = JSON.stringify({
			piles: this.piles,
			score: this.score,
			moves: this.moves,
		});
		this.history.push(state);
	}

	undo() {
		if (this.history.length === 0) return;
		const prevState = JSON.parse(this.history.pop());

		// Restore objects from plain data
		this.piles.stock = prevState.piles.stock.map(
			(c) => new Card(c.suit, c.value, c.faceUp),
		);
		this.piles.waste = prevState.piles.waste.map(
			(c) => new Card(c.suit, c.value, c.faceUp),
		);
		this.piles.foundation = prevState.piles.foundation.map((f) =>
			f.map((c) => new Card(c.suit, c.value, c.faceUp)),
		);
		this.piles.tableau = prevState.piles.tableau.map((t) =>
			t.map((c) => new Card(c.suit, c.value, c.faceUp)),
		);

		this.score = prevState.score;
		this.moves = prevState.moves;
		this.render();
	}

	render() {
		// Update stats
		document.getElementById("score").textContent = this.score;
		document.getElementById("moves").textContent = this.moves;

		// Render stock
		const stockEl = document.getElementById("stock");
		stockEl.innerHTML = "";
		if (this.piles.stock.length > 0) {
			const card = this.piles.stock[this.piles.stock.length - 1];
			const cardEl = card.render();
			cardEl.classList.add("face-down");
			stockEl.appendChild(cardEl);
		}

		// Render waste
		const wasteEl = document.getElementById("waste");
		wasteEl.innerHTML = "";
		if (this.piles.waste.length > 0) {
			const card = this.piles.waste[this.piles.waste.length - 1];
			wasteEl.appendChild(card.render());
		}

		// Render foundation
		for (let i = 0; i < 4; i++) {
			const foundationEl = document.getElementById(`foundation-${i}`);
			foundationEl.innerHTML = "";
			if (this.piles.foundation[i].length > 0) {
				const card =
					this.piles.foundation[i][this.piles.foundation[i].length - 1];
				foundationEl.appendChild(card.render());
			}
		}

		// Render tableau
		for (let i = 0; i < 7; i++) {
			const tableauEl = document.getElementById(`tableau-${i}`);
			tableauEl.innerHTML = "";
			this.piles.tableau[i].forEach((card, index) => {
				const cardEl = card.render();
				cardEl.style.top = `${index * 30}px`;
				tableauEl.appendChild(cardEl);
			});
		}
	}

	setupEventListeners() {
		// Stock click
		document.getElementById("stock").addEventListener("click", () => {
			this.saveState();
			if (this.piles.stock.length === 0) {
				this.piles.stock = this.piles.waste.reverse().map((c) => {
					c.faceUp = false;
					return c;
				});
				this.piles.waste = [];
			} else {
				const card = this.piles.stock.pop();
				card.faceUp = true;
				this.piles.waste.push(card);
			}
			this.moves++;
			this.render();
		});

		// Undo click
		document.getElementById("undo").addEventListener("click", (e) => {
			e.preventDefault();
			this.undo();
		});

		// New Game click
		document.getElementById("new-game").addEventListener("click", (e) => {
			e.preventDefault();
			this.init();
		});

		// Board events for drag & drop
		const board = document.querySelector(".solitaire-board");

		board.addEventListener("dragstart", (e) => {
			if (
				!e.target.classList.contains("card") ||
				e.target.classList.contains("face-down")
			) {
				e.preventDefault();
				return;
			}
			const cardId = e.target.id;
			const pileInfo = this.findCardPile(cardId);
			if (!pileInfo) return;

			e.dataTransfer.setData(
				"text/plain",
				JSON.stringify({
					cardId,
					fromPile: pileInfo.type,
					pileIndex: pileInfo.index,
					cardIndex: pileInfo.cardIndex,
				}),
			);

			setTimeout(() => e.target.classList.add("dragging"), 0);
		});

		board.addEventListener("dragend", (e) => {
			e.target.classList.remove("dragging");
		});

		board.addEventListener("dragover", (e) => {
			e.preventDefault();
		});

		board.addEventListener("drop", (e) => {
			e.preventDefault();
			const data = JSON.parse(e.dataTransfer.getData("text/plain"));
			const toPileEl = e.target.closest(".pile");
			if (!toPileEl) return;

			const toPileType = toPileEl.id.split("-")[0];
			const toPileIndex = parseInt(toPileEl.id.split("-")[1]) || 0;

			this.moveCards(data, toPileType, toPileIndex);
		});

		// Double click to auto-move
		board.addEventListener("dblclick", (e) => {
			const cardEl = e.target.closest(".card");
			if (!cardEl || cardEl.classList.contains("face-down")) return;

			const cardId = cardEl.id;
			const pileInfo = this.findCardPile(cardId);
			if (!pileInfo) return;

			// Only allow top cards or waste cards to auto-move
			const pile = this.getPile(pileInfo.type, pileInfo.index);
			if (pileInfo.cardIndex !== pile.length - 1) return;

			const card = pile[pileInfo.cardIndex];

			// Try to find a foundation
			for (let i = 0; i < 4; i++) {
				if (this.isValidMove(card, "foundation", i)) {
					this.saveState();
					const movedCard = pile.pop();
					this.piles.foundation[i].push(movedCard);
					this.afterMove(pileInfo.type, pileInfo.index);
					return;
				}
			}
		});

		// Win modal
		document.getElementById("play-again").addEventListener("click", () => {
			document.getElementById("win-modal").classList.remove("active");
			this.init();
		});
	}

	findCardPile(cardId) {
		// Check waste
		if (
			this.piles.waste.length > 0 &&
			this.piles.waste[this.piles.waste.length - 1].id === cardId
		) {
			return {
				type: "waste",
				index: 0,
				cardIndex: this.piles.waste.length - 1,
			};
		}
		// Check foundations
		for (let i = 0; i < 4; i++) {
			if (
				this.piles.foundation[i].length > 0 &&
				this.piles.foundation[i][this.piles.foundation[i].length - 1].id ===
					cardId
			) {
				return {
					type: "foundation",
					index: i,
					cardIndex: this.piles.foundation[i].length - 1,
				};
			}
		}
		// Check tableau
		for (let i = 0; i < 7; i++) {
			const cardIndex = this.piles.tableau[i].findIndex((c) => c.id === cardId);
			if (cardIndex !== -1) {
				return { type: "tableau", index: i, cardIndex };
			}
		}
		return null;
	}

	getPile(type, index) {
		if (type === "waste") return this.piles.waste;
		if (type === "foundation") return this.piles.foundation[index];
		if (type === "tableau") return this.piles.tableau[index];
		return null;
	}

	isValidMove(card, toType, toIndex) {
		const toPile = this.getPile(toType, toIndex);
		const topCard = toPile.length > 0 ? toPile[toPile.length - 1] : null;

		if (toType === "foundation") {
			// Foundation rules: Same suit, A then 2, 3...
			if (!topCard) {
				return card.value === "A";
			}
			return card.suit === topCard.suit && card.rank === topCard.rank + 1;
		}

		if (toType === "tableau") {
			// Tableau rules: Alternating color, K then Q, J, 10...
			if (!topCard) {
				return card.value === "K";
			}
			return card.color !== topCard.color && card.rank === topCard.rank - 1;
		}

		return false;
	}

	moveCards(data, toType, toIndex) {
		const fromPile = this.getPile(data.fromPile, data.pileIndex);
		const cardsToMove = fromPile.slice(data.cardIndex);
		const firstCard = cardsToMove[0];

		if (this.isValidMove(firstCard, toType, toIndex)) {
			// Check if moving multiple cards to foundation (not allowed)
			if (toType === "foundation" && cardsToMove.length > 1) return;

			this.saveState();
			const toPile = this.getPile(toType, toIndex);

			// Remove from source
			fromPile.splice(data.cardIndex);

			// Add to destination
			cardsToMove.forEach((c) => toPile.push(c));

			this.afterMove(data.fromPile, data.pileIndex, toType === "foundation");
		}
	}

	afterMove(fromType, fromIndex, toFoundation = false) {
		const fromPile = this.getPile(fromType, fromIndex);

		// Flip top card if tableau
		if (fromType === "tableau" && fromPile.length > 0) {
			const lastCard = fromPile[fromPile.length - 1];
			if (!lastCard.faceUp) {
				lastCard.faceUp = true;
				this.score += 5;
			}
		}

		if (toFoundation) {
			this.score += 10;
		}

		this.moves++;
		this.render();
		this.checkWin();
	}

	checkWin() {
		const totalCardsInFoundation = this.piles.foundation.reduce(
			(acc, f) => acc + f.length,
			0,
		);
		if (totalCardsInFoundation === 52) {
			this.win();
		}
	}

	win() {
		clearInterval(this.timerInterval);
		document.getElementById("final-score").textContent = this.score;
		document.getElementById("final-time").textContent =
			document.getElementById("timer").textContent;
		document.getElementById("win-modal").classList.add("active");

		// Confetti!
		confetti({
			particleCount: 150,
			spread: 70,
			origin: { y: 0.6 },
		});
	}
}

// Start game
window.addEventListener("DOMContentLoaded", () => {
	new Game();
});
