import {
	GRID_SIZE,
	PLAYER_ZONE_START,
	UNIT_TYPES,
	BASE_TICK_RATE,
	BATTLE_SPEED_OPTIONS,
	INITIAL_GOLD,
	ROUND_INCOME,
	WIN_GOLD,
	LOSS_GOLD,
	REROLL_COST,
	SHOP_SIZE,
	SCOUT_DURATION,
	LOG_LIMIT,
} from "./constants.js";
import { Unit } from "./unit.js";
import { UI } from "./ui.js";

const PHASES = {
	SCOUT: "SCOUT",
	PREP: "PREP",
	BATTLE: "BATTLE",
	GAMEOVER: "GAMEOVER",
};

const CELL_COLUMNS = "ABCDEFGH";

const byId = (id) => document.getElementById(id);

const buildSlots = (rows, columns) => {
	const slots = [];
	rows.forEach((row) => {
		columns.forEach((column) => {
			slots.push({ x: column, y: row });
		});
	});
	return slots;
};

class Game {
	constructor() {
		this.gold = INITIAL_GOLD;
		this.round = 1;
		this.phase = PHASES.SCOUT;
		this.units = [];
		this.shopUnits = [];
		this.selectedShopIndex = null;
		this.selectedUnitId = null;
		this.hoveredCell = null;
		this.shopLocked = false;
		this.logEntries = [];
		this.scoutCountdown = null;
		this.scoutSecondsLeft = Math.ceil(SCOUT_DURATION / 1000);
		this.battleInterval = null;
		this.battleSpeedIndex = 0;
		this.isBattlePaused = false;

		this.ui = new UI(this);

		this.init();
	}

	init() {
		this.bindControls();
		this.spawnEnemies();
		this.rerollShop(false, true);
		this.addLog(
			"Round 1 briefing: enemy formation detected. Scout before committing your lineup.",
			"info",
		);
		this.updateUI();
		this.startScoutPhase();
	}

	bindControls() {
		byId("reroll-btn").addEventListener("click", () => this.rerollShop(true));
		byId("start-battle-btn").addEventListener("click", () =>
			this.startBattle(),
		);
		byId("next-round-btn").addEventListener("click", () => this.nextRound());
		byId("skip-scout-btn").addEventListener("click", () =>
			this.endScoutPhase(),
		);
		byId("sell-unit-btn").addEventListener("click", () =>
			this.sellSelectedUnit(),
		);
		byId("auto-arrange-btn").addEventListener("click", () =>
			this.autoArrangeArmy(),
		);
		byId("lock-shop-btn").addEventListener("click", () =>
			this.toggleShopLock(),
		);
		byId("pause-battle-btn").addEventListener("click", () =>
			this.toggleBattlePause(),
		);

		document.querySelectorAll("[data-speed]").forEach((button) => {
			button.addEventListener("click", () => {
				this.setBattleSpeed(Number(button.dataset.speed));
			});
		});
	}

	getCellLabel(x, y) {
		return `${CELL_COLUMNS[x] || x}${y + 1}`;
	}

	getTeamUnits(team, aliveOnly = true) {
		return this.units.filter(
			(unit) => unit.team === team && (!aliveOnly || unit.isAlive()),
		);
	}

	getUnitAt(x, y) {
		return (
			this.units.find(
				(unit) => unit.isAlive() && unit.x === x && unit.y === y,
			) || null
		);
	}

	getUnitById(id) {
		return this.units.find((unit) => unit.id === id && unit.isAlive()) || null;
	}

	getSelectedUnit() {
		return this.getUnitById(this.selectedUnitId);
	}

	getHoveredUnit() {
		if (!this.hoveredCell) return null;
		return this.getUnitAt(this.hoveredCell.x, this.hoveredCell.y);
	}

	getSelectedRecruit() {
		if (this.selectedShopIndex === null) return null;
		const unitKey = this.shopUnits[this.selectedShopIndex];
		return unitKey ? { typeKey: unitKey, ...UNIT_TYPES[unitKey] } : null;
	}

	getBattleSpeed() {
		return BATTLE_SPEED_OPTIONS[this.battleSpeedIndex] || 1;
	}

	getBattleTickRate() {
		return Math.max(130, Math.floor(BASE_TICK_RATE / this.getBattleSpeed()));
	}

	addLog(message, tone = "info") {
		this.logEntries.push({
			round: this.round,
			message,
			tone,
		});

		if (this.logEntries.length > LOG_LIMIT) {
			this.logEntries = this.logEntries.slice(-LOG_LIMIT);
		}
	}

	summarizeTeam(team) {
		const units = this.getTeamUnits(team, true);
		const totalHp = units.reduce((sum, unit) => sum + unit.hp, 0);
		const totalMaxHp = units.reduce((sum, unit) => sum + unit.maxHp, 0);
		const totalDamage = units.reduce((sum, unit) => sum + unit.damage, 0);
		const totalValue = units.reduce((sum, unit) => sum + unit.cost, 0);
		const melee = units.filter((unit) => unit.range <= 1).length;
		const ranged = units.filter((unit) => unit.range > 1).length;
		const threat = Math.round(
			units.reduce(
				(sum, unit) =>
					sum +
					unit.maxHp * 0.12 +
					unit.damage * 3.4 +
					unit.range * 6 +
					Math.max(0, 3 - unit.speed) * 4,
				0,
			),
		);

		const rosterMap = new Map();
		units.forEach((unit) => {
			const existing = rosterMap.get(unit.typeKey) || {
				typeKey: unit.typeKey,
				icon: unit.icon,
				name: unit.name,
				role: unit.role,
				count: 0,
				totalCost: 0,
			};

			existing.count += 1;
			existing.totalCost += unit.cost;
			rosterMap.set(unit.typeKey, existing);
		});

		const roster = Array.from(rosterMap.values()).sort(
			(a, b) =>
				b.count - a.count ||
				b.totalCost - a.totalCost ||
				a.name.localeCompare(b.name),
		);

		return {
			team,
			units,
			count: units.length,
			totalHp,
			totalMaxHp,
			totalDamage,
			totalValue,
			melee,
			ranged,
			threat,
			roster,
			kills: units.reduce((sum, unit) => sum + unit.kills, 0),
			damageDealt: units.reduce((sum, unit) => sum + unit.damageDealt, 0),
		};
	}

	getPhaseMeta() {
		const selectedUnit = this.getSelectedUnit();
		const selectedRecruit = this.getSelectedRecruit();

		switch (this.phase) {
			case PHASES.SCOUT:
				return {
					label: "Scout",
					tone: "scout",
					title: "Scout the hostile formation",
					description:
						"Enemy positions are fully revealed before your shop and deployment open.",
					hint: "Study lanes now. You cannot buy or deploy until the scout timer ends.",
				};
			case PHASES.PREP:
				return {
					label: "Prep",
					tone: "prep",
					title: "Build your formation",
					description:
						"Recruit, reposition, sell, auto-arrange, and lock the shop before combat begins.",
					hint: selectedRecruit
						? `Deploy ${selectedRecruit.name} onto any empty ally tile.`
						: selectedUnit && selectedUnit.team === "player"
							? `Selected ${selectedUnit.name}. Click any empty ally tile to reposition it.`
							: "Click a recruit card to deploy it, or click any unit on the board to inspect it.",
				};
			case PHASES.BATTLE:
				return {
					label: "Battle",
					tone: "battle",
					title: this.isBattlePaused ? "Battle paused" : "Battle underway",
					description: `Combat is running at ${this.getBattleSpeed()}x speed.`,
					hint: this.isBattlePaused
						? "Resume when you are ready."
						: "You can pause the fight or change battle speed while it runs.",
				};
			case PHASES.GAMEOVER:
			default:
				return {
					label: "Result",
					tone: "result",
					title: "Round complete",
					description:
						"Collect your payout and move survivors into the next wave.",
					hint: "Continue to heal allies, scout the next enemy squad, and improve the lineup.",
				};
		}
	}

	startScoutPhase() {
		clearInterval(this.scoutCountdown);
		this.phase = PHASES.SCOUT;
		this.selectedShopIndex = null;
		this.isBattlePaused = false;
		this.scoutSecondsLeft = Math.ceil(SCOUT_DURATION / 1000);

		this.scoutCountdown = setInterval(() => {
			this.scoutSecondsLeft -= 1;
			if (this.scoutSecondsLeft <= 0) {
				this.endScoutPhase();
				return;
			}
			this.updateUI();
		}, 1000);

		this.updateUI();
	}

	endScoutPhase() {
		if (this.phase !== PHASES.SCOUT) return;

		clearInterval(this.scoutCountdown);
		this.scoutCountdown = null;
		this.phase = PHASES.PREP;
		this.scoutSecondsLeft = 0;
		this.addLog(
			"Scout phase complete. Command of ally placement and shop controls is now live.",
			"info",
		);
		this.updateUI();
	}

	rerollShop(isManual = false, force = false) {
		if (isManual && this.phase !== PHASES.PREP) return;

		const keys = Object.keys(UNIT_TYPES);
		const randomShopUnit = () => keys[Math.floor(Math.random() * keys.length)];

		if (isManual) {
			if (this.gold < REROLL_COST) {
				this.addLog("Not enough gold to reroll the shop.", "warning");
				this.updateUI();
				return;
			}
			this.gold -= REROLL_COST;
		} else if (!force && this.shopLocked && this.shopUnits.length > 0) {
			this.shopUnits = this.shopUnits.map(
				(unitKey) => unitKey || randomShopUnit(),
			);
			this.selectedShopIndex = null;
			this.addLog(
				"Shop lock held your saved offers and refreshed any empty slots.",
				"info",
			);
			this.updateUI();
			return;
		}
		this.shopUnits = [];

		while (this.shopUnits.length < SHOP_SIZE) {
			this.shopUnits.push(randomShopUnit());
		}

		this.selectedShopIndex = null;
		if (isManual) {
			this.addLog(`Shop rerolled for ${REROLL_COST} gold.`, "info");
		}

		this.updateUI();
	}

	buyFromShop(index) {
		if (this.phase !== PHASES.PREP) return;

		const unitKey = this.shopUnits[index];
		if (!unitKey) return;

		const config = UNIT_TYPES[unitKey];
		if (this.gold < config.cost) return;

		if (this.selectedShopIndex === index) {
			this.selectedShopIndex = null;
		} else {
			this.selectedShopIndex = index;
			this.selectedUnitId = null;
		}

		this.updateUI();
	}

	selectUnit(unit) {
		this.selectedUnitId = unit ? unit.id : null;
		if (unit) {
			this.selectedShopIndex = null;
		}
	}

	canDeployTo(x, y) {
		return y >= PLAYER_ZONE_START && !this.getUnitAt(x, y);
	}

	handleCellHover(x, y) {
		this.hoveredCell = { x, y };
		this.updateUI();
	}

	clearHoveredCell(x, y) {
		if (!this.hoveredCell) return;
		if (this.hoveredCell.x === x && this.hoveredCell.y === y) {
			this.hoveredCell = null;
			this.updateUI();
		}
	}

	handleCellClick(x, y) {
		const clickedUnit = this.getUnitAt(x, y);
		this.hoveredCell = { x, y };

		if (this.phase !== PHASES.PREP) {
			this.selectUnit(clickedUnit);
			this.updateUI();
			return;
		}

		if (this.selectedShopIndex !== null) {
			if (this.canDeployTo(x, y)) {
				this.deploySelectedShopUnit(x, y);
				return;
			}

			if (clickedUnit) {
				this.selectUnit(clickedUnit);
			}
			this.updateUI();
			return;
		}

		const selectedUnit = this.getSelectedUnit();
		if (clickedUnit) {
			this.selectUnit(clickedUnit);
			this.updateUI();
			return;
		}

		if (
			selectedUnit &&
			selectedUnit.team === "player" &&
			this.canDeployTo(x, y)
		) {
			this.moveSelectedUnitTo(x, y);
			return;
		}

		this.selectedUnitId = null;
		this.updateUI();
	}

	deploySelectedShopUnit(x, y) {
		const unitKey = this.shopUnits[this.selectedShopIndex];
		if (!unitKey) return;

		const config = UNIT_TYPES[unitKey];
		const newUnit = new Unit(unitKey, config, x, y, "player");

		this.units.push(newUnit);
		this.gold -= config.cost;
		this.shopUnits[this.selectedShopIndex] = null;
		this.selectedShopIndex = null;
		this.selectedUnitId = newUnit.id;
		this.addLog(
			`Deployed ${newUnit.name} to ${this.getCellLabel(x, y)}.`,
			"success",
		);
		this.updateUI();
	}

	moveSelectedUnitTo(x, y) {
		const unit = this.getSelectedUnit();
		if (!unit || unit.team !== "player") return;

		const from = this.getCellLabel(unit.x, unit.y);
		unit.x = x;
		unit.y = y;
		this.addLog(
			`Repositioned ${unit.name} from ${from} to ${this.getCellLabel(x, y)}.`,
			"info",
		);
		this.updateUI();
	}

	sellSelectedUnit() {
		if (this.phase !== PHASES.PREP) return;

		const unit = this.getSelectedUnit();
		if (!unit || unit.team !== "player") return;

		const refund = Math.floor(unit.cost * 0.75);
		this.gold += refund;
		this.units = this.units.filter((existing) => existing.id !== unit.id);
		this.selectedUnitId = null;
		this.addLog(`Sold ${unit.name} for ${refund} gold.`, "warning");
		this.updateUI();
	}

	autoArrangeArmy() {
		if (this.phase !== PHASES.PREP) return;

		const playerUnits = this.getTeamUnits("player");
		if (!playerUnits.length) return;

		const columnPriority = [3, 4, 2, 5, 1, 6, 0, 7];
		const poolByBand = {
			front: buildSlots(
				[PLAYER_ZONE_START, PLAYER_ZONE_START + 1],
				columnPriority,
			),
			mid: buildSlots(
				[PLAYER_ZONE_START + 1, PLAYER_ZONE_START + 2],
				columnPriority,
			),
			back: buildSlots([GRID_SIZE - 2, GRID_SIZE - 1], columnPriority),
		};
		const fallbackSlots = buildSlots(
			[
				PLAYER_ZONE_START,
				PLAYER_ZONE_START + 1,
				PLAYER_ZONE_START + 2,
				GRID_SIZE - 1,
			],
			columnPriority,
		);
		const used = new Set();

		const takeSlot = (band) => {
			const pools = [poolByBand[band] || [], fallbackSlots];
			for (const pool of pools) {
				for (const slot of pool) {
					const key = `${slot.x},${slot.y}`;
					if (!used.has(key)) {
						used.add(key);
						return slot;
					}
				}
			}
			return null;
		};

		const bandPriority = { front: 0, mid: 1, back: 2 };
		const sorted = [...playerUnits].sort(
			(a, b) =>
				(bandPriority[a.preferredBand] ?? 1) -
					(bandPriority[b.preferredBand] ?? 1) ||
				b.maxHp - a.maxHp ||
				b.range - a.range,
		);

		sorted.forEach((unit) => {
			const slot = takeSlot(unit.preferredBand);
			if (slot) {
				unit.x = slot.x;
				unit.y = slot.y;
			}
		});

		this.selectedUnitId = sorted[0]?.id ?? null;
		this.addLog(
			"Auto-arranged ally formation based on unit role and preferred lane depth.",
			"info",
		);
		this.updateUI();
	}

	toggleShopLock() {
		if (this.phase === PHASES.BATTLE) return;

		this.shopLocked = !this.shopLocked;
		this.addLog(
			this.shopLocked
				? "Shop locked. Current offers will hold into the next round."
				: "Shop unlocked. Next round will refresh normally.",
			"info",
		);
		this.updateUI();
	}

	spawnEnemies() {
		const enemyCount = Math.min(2 + Math.floor(this.round / 2), 12);
		const types = Object.keys(UNIT_TYPES);
		const maxAttempts = 120;

		for (let i = 0; i < enemyCount; i++) {
			const typeKey = types[Math.floor(Math.random() * types.length)];
			const config = UNIT_TYPES[typeKey];

			let attempts = 0;
			let placed = false;

			while (attempts < maxAttempts && !placed) {
				const x = Math.floor(Math.random() * GRID_SIZE);
				const y = Math.floor(Math.random() * PLAYER_ZONE_START);
				if (!this.getUnitAt(x, y)) {
					this.units.push(new Unit(typeKey, config, x, y, "enemy"));
					placed = true;
				}
				attempts++;
			}
		}
	}

	restartBattleInterval() {
		clearInterval(this.battleInterval);
		this.battleInterval = null;

		if (this.phase === PHASES.BATTLE && !this.isBattlePaused) {
			this.battleInterval = setInterval(
				() => this.battleTick(),
				this.getBattleTickRate(),
			);
		}
	}

	startBattle() {
		if (this.phase !== PHASES.PREP) return;

		if (!this.getTeamUnits("player").length) {
			this.addLog(
				"Place at least one ally unit before starting the battle.",
				"warning",
			);
			this.updateUI();
			return;
		}

		this.phase = PHASES.BATTLE;
		this.selectedShopIndex = null;
		this.isBattlePaused = false;
		this.addLog(`Battle started at ${this.getBattleSpeed()}x speed.`, "danger");
		this.restartBattleInterval();
		this.updateUI();
	}

	toggleBattlePause() {
		if (this.phase !== PHASES.BATTLE) return;

		this.isBattlePaused = !this.isBattlePaused;
		this.restartBattleInterval();
		this.addLog(
			this.isBattlePaused ? "Battle paused." : "Battle resumed.",
			"info",
		);
		this.updateUI();
	}

	setBattleSpeed(multiplier) {
		const nextIndex = BATTLE_SPEED_OPTIONS.indexOf(multiplier);
		if (nextIndex === -1 || nextIndex === this.battleSpeedIndex) return;

		this.battleSpeedIndex = nextIndex;
		if (this.phase === PHASES.BATTLE) {
			this.restartBattleInterval();
		}

		this.addLog(`Battle speed set to ${multiplier}x.`, "info");
		this.updateUI();
	}

	battleTick() {
		if (this.phase !== PHASES.BATTLE || this.isBattlePaused) return;

		const shuffledUnits = [...this.units.filter((unit) => unit.isAlive())];
		for (let i = shuffledUnits.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[shuffledUnits[i], shuffledUnits[j]] = [
				shuffledUnits[j],
				shuffledUnits[i],
			];
		}

		const attackEvents = [];

		shuffledUnits.forEach((unit) => {
			const result = unit.step(this.units, GRID_SIZE);
			if (result?.type === "attack") {
				attackEvents.push(result);
				if (result.defeated) {
					const eliminatedTeam =
						result.target.team === "enemy" ? "enemy" : "ally";
					this.addLog(
						`${result.attacker.name} eliminated ${eliminatedTeam} ${result.target.name} at ${this.getCellLabel(result.target.x, result.target.y)}.`,
						result.attacker.team === "player" ? "success" : "danger",
					);
				}
			}
		});

		this.units = this.units.filter((unit) => unit.isAlive());
		if (this.selectedUnitId && !this.getSelectedUnit()) {
			this.selectedUnitId = null;
		}

		this.updateUI();
		attackEvents.forEach((event) =>
			this.ui.fireProjectile(event.attacker, event.target),
		);
		this.checkBattleEnd();
	}

	checkBattleEnd() {
		const playerAlive = this.getTeamUnits("player").length > 0;
		const enemyAlive = this.getTeamUnits("enemy").length > 0;

		if (!playerAlive || !enemyAlive) {
			clearInterval(this.battleInterval);
			this.battleInterval = null;
			this.endBattle(playerAlive);
		}
	}

	endBattle(won) {
		this.phase = PHASES.GAMEOVER;
		this.isBattlePaused = false;
		const reward = won ? WIN_GOLD : LOSS_GOLD;
		this.gold += reward;

		const playerSurvivors = this.getTeamUnits("player").length;
		const enemySurvivors = this.getTeamUnits("enemy").length;

		this.addLog(
			won
				? `Victory secured. ${reward} gold collected and ${playerSurvivors} allies survived.`
				: `Defeat. ${reward} gold salvage recovered and ${enemySurvivors} hostiles remained.`,
			won ? "success" : "danger",
		);

		this.ui.showOverlay({
			won,
			reward,
			round: this.round,
			playerSurvivors,
			enemySurvivors,
		});
		this.updateUI();
	}

	nextRound() {
		this.round++;
		this.phase = PHASES.SCOUT;
		this.hoveredCell = null;
		this.selectedShopIndex = null;
		this.selectedUnitId = null;
		this.isBattlePaused = false;

		this.units = this.getTeamUnits("player");
		this.units.forEach((unit) => unit.resetForRound());
		this.gold += ROUND_INCOME;

		this.spawnEnemies();
		this.rerollShop(false);
		this.ui.hideOverlay();
		this.addLog(
			`Round ${this.round} begins. ${ROUND_INCOME} gold income received and enemy lanes updated.`,
			"info",
		);
		this.updateUI();
		this.startScoutPhase();
	}

	getUIState() {
		const phaseMeta = this.getPhaseMeta();
		const selectedUnit = this.getSelectedUnit();
		const hoveredUnit = this.getHoveredUnit();
		const selectedRecruit = this.getSelectedRecruit();
		const playerSummary = this.summarizeTeam("player");
		const enemySummary = this.summarizeTeam("enemy");

		return {
			gold: this.gold,
			round: this.round,
			phase: this.phase,
			phaseMeta,
			scoutSecondsLeft: this.scoutSecondsLeft,
			battleSpeed: this.getBattleSpeed(),
			battleSpeedOptions: BATTLE_SPEED_OPTIONS,
			isBattlePaused: this.isBattlePaused,
			shopLocked: this.shopLocked,
			shopUnits: this.shopUnits,
			selectedShopIndex: this.selectedShopIndex,
			selectedRecruit,
			selectedUnitId: this.selectedUnitId,
			selectedUnit,
			hoveredCell: this.hoveredCell,
			hoveredUnit,
			units: this.units,
			logEntries: [...this.logEntries].reverse(),
			playerSummary,
			enemySummary,
			canStartBattle: this.phase === PHASES.PREP && playerSummary.count > 0,
			canPauseBattle: this.phase === PHASES.BATTLE,
			canReroll: this.phase === PHASES.PREP && this.gold >= REROLL_COST,
			canSellSelected:
				this.phase === PHASES.PREP &&
				!!selectedUnit &&
				selectedUnit.team === "player",
			canAutoArrange: this.phase === PHASES.PREP && playerSummary.count > 1,
			shopStatus: this.shopLocked
				? "Locked for next round"
				: `${this.shopUnits.filter(Boolean).length}/${this.shopUnits.length} offers available`,
			actionHint: phaseMeta.hint,
		};
	}

	updateUI() {
		this.ui.render(this.getUIState());
	}
}

window.addEventListener("DOMContentLoaded", () => {
	new Game();
});
