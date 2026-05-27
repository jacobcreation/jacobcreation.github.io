const {
	Engine,
	Runner,
	Events,
	MouseConstraint,
	Mouse,
	Composite,
	Bodies,
	Body,
	Constraint,
	Vector,
} = Matter;

const STORAGE_KEY = "angry-fowl-best-score";
const LEVELS = [
	{
		name: "Porch Panic",
		objective: "Punch through the front towers and clean up the middle pig.",
		birds: ["red", "blue", "yellow"],
		startX: 1180,
		build(bottomY) {
			buildTower(1180, bottomY, "block", "glass");
			buildTower(1400, bottomY, "block", "stone");
			addBlock(1290, bottomY - 18, 96, 36, "crate");
			addPig(1290, bottomY - 60);
		},
	},
	{
		name: "Glass House",
		objective:
			"Chain shatters together. Blue birds are best once the launch is underway.",
		birds: ["blue", "yellow", "red", "blue"],
		startX: 1360,
		build(bottomY) {
			buildTower(1290, bottomY, "glass", "glass");
			buildTower(1490, bottomY, "glass", "stone");
			addBlock(1390, bottomY - 32, 150, 28, "glass");
			addPig(1390, bottomY - 70);
			addBlock(1390, bottomY - 170, 70, 24, "stone");
			addPig(1390, bottomY - 210);
		},
	},
	{
		name: "Fortress Finale",
		objective: "Use speed to crack the stone shell, then sweep the pig stack.",
		birds: ["yellow", "red", "blue", "yellow", "red"],
		startX: 1540,
		build(bottomY) {
			buildTower(1460, bottomY, "stone", "crate");
			buildTower(1640, bottomY, "stone", "glass");
			addBlock(1550, bottomY - 20, 170, 40, "stone");
			addPig(1550, bottomY - 66);
			addBlock(1550, bottomY - 162, 124, 26, "crate");
			addPig(1518, bottomY - 202);
			addPig(1582, bottomY - 202);
		},
	},
];

const BIRD_TYPES = {
	red: {
		name: "Classic Red",
		description:
			"Reliable impact bird. No special ability, just pure attitude.",
		cssClass: "bird-red",
		badgeReady: "Impact",
		badgeUsed: "Spent",
		radius: 22,
		density: 0.005,
		restitution: 0.55,
	},
	blue: {
		name: "Split Blue",
		description:
			"Press Space after launch to split into two side birds for wider damage.",
		cssClass: "bird-blue",
		badgeReady: "Split Ready",
		badgeUsed: "Split Used",
		radius: 19,
		density: 0.0042,
		restitution: 0.56,
		useAbility(sourceBird) {
			const velocity = sourceBird.velocity;
			const speed = Math.max(8, Vector.magnitude(velocity));
			const direction = Vector.normalise(
				speed > 0 ? velocity : { x: 1, y: -0.2 },
			);
			const perpendicular = Vector.perp(direction);
			const offsets = [-18, 18];

			offsets.forEach((offset) => {
				const spawnPosition = Vector.add(
					sourceBird.position,
					Vector.mult(perpendicular, offset),
				);
				const clone = Bodies.circle(spawnPosition.x, spawnPosition.y, 12, {
					restitution: 0.52,
					density: 0.0035,
					friction: 0.45,
					label: "bird",
					collisionFilter: { category: 0x0001 },
				});

				clone.customType = "blue";
				clone.hasAbility = false;
				createDOMElement(clone, `bird ${BIRD_TYPES.blue.cssClass}`, 24, 24);
				Body.setVelocity(
					clone,
					Vector.add(
						velocity,
						Vector.mult(perpendicular, offset > 0 ? 0.35 : -0.35),
					),
				);
				Composite.add(engine.world, clone);
				activeProjectiles.push(clone);
			});

			addStatus("Split shot activated.", "ability");
			addScore(75, sourceBird, "Split bonus");
		},
	},
	yellow: {
		name: "Dash Yellow",
		description:
			"Press Space after launch to burst forward and smash heavy walls.",
		cssClass: "bird-yellow",
		badgeReady: "Boost Ready",
		badgeUsed: "Boost Used",
		radius: 21,
		density: 0.0052,
		restitution: 0.5,
		useAbility(sourceBird) {
			const velocity = sourceBird.velocity;
			const direction = Vector.normalise(
				Vector.magnitude(velocity) > 0 ? velocity : { x: 1, y: 0 },
			);
			Body.setVelocity(
				sourceBird,
				Vector.add(velocity, Vector.mult(direction, 8)),
			);
			addStatus("Speed boost engaged.", "ability");
			addImpactBurst(sourceBird.position.x, sourceBird.position.y);
		},
	},
};

let engine;
let runner;
let mouseConstraint;
let gameMouse;
let bird;
let slingshotConstraint;
let activeProjectiles = [];
let enemies = [];
let blocks = [];
let bodyToElement = new Map();
let destroyedBodies = new WeakSet();
let score = 0;
let comboCount = 1;
let comboTimer = 0;
let isFired = false;
let frameCount = 0;
let stopTimer = 0;
let cameraX = 0;
let gameState = "loading";
let currentLevelIndex = 0;
let currentBirdQueue = [];
let birdsRemaining = 0;
let bestScore = Number(localStorage.getItem(STORAGE_KEY) || 0);
let currentBirdType = null;
let currentBirdAbilityUsed = false;
let lastResult = null;

let GAME_WIDTH = window.innerWidth;
let GAME_HEIGHT = window.innerHeight;
let WORLD_WIDTH = Math.max(3200, window.innerWidth * 2.2);
let GROUND_Y = GAME_HEIGHT * 0.85;
let SLING_X = 240;
let SLING_Y = GROUND_Y - 150;

const gameContainer = document.getElementById("game-container");
const gameLayer = document.getElementById("game-layer");
const slingshotBand = document.getElementById("slingshot-band");
const birdsCountEl = document.getElementById("birds-count");
const scoreEl = document.getElementById("score");
const bestScoreEl = document.getElementById("best-score");
const comboEl = document.getElementById("combo-count");
const levelLabelEl = document.getElementById("level-label");
const objectiveTextEl = document.getElementById("objective-text");
const birdTypeNameEl = document.getElementById("bird-type-name");
const birdTypeDescEl = document.getElementById("bird-type-desc");
const birdTypeBadgeEl = document.getElementById("bird-type-badge");
const statusMessageEl = document.getElementById("status-message");
const powerFillEl = document.getElementById("power-fill");
const pauseOverlay = document.getElementById("pause-overlay");
const endScreen = document.getElementById("end-screen");
const endTitleEl = document.getElementById("end-title");
const finalScoreEl = document.getElementById("final-score");
const finalBestScoreEl = document.getElementById("final-best-score");
const nextLevelButton = document.getElementById("next-level-button");
const levelSelectOverlay = document.getElementById("level-select");
const levelButtonsEl = document.getElementById("level-buttons");
const abilityButton = document.getElementById("ability-button");
const mobilePauseButton = document.getElementById("mobile-pause-button");
const mobileRestartButton = document.getElementById("mobile-restart-button");

function init() {
	buildLevelButtons();
	bindUI();
	startRun(0, false);
	requestAnimationFrame(renderLoop);
}

function bindUI() {
	document
		.getElementById("restart-button")
		.addEventListener("click", () => startRun(currentLevelIndex, false));
	document
		.getElementById("reset-button-end")
		.addEventListener("click", () => startRun(0, false));
	document
		.getElementById("pause-button")
		.addEventListener("click", togglePause);
	document
		.getElementById("resume-button")
		.addEventListener("click", togglePause);
	nextLevelButton.addEventListener("click", handleNextLevel);

	window.addEventListener("keydown", handleKeydown);
	abilityButton?.addEventListener("click", triggerBirdAbility);
	mobilePauseButton?.addEventListener("click", togglePause);
	mobileRestartButton?.addEventListener("click", () =>
		startRun(currentLevelIndex, false),
	);
}

function buildLevelButtons() {
	levelButtonsEl.innerHTML = "";
	LEVELS.forEach((level, index) => {
		const button = document.createElement("button");
		button.className = "level-button";
		button.innerHTML = `<strong>${index + 1}. ${level.name}</strong><span>${level.objective}</span>`;
		button.addEventListener("click", () => {
			levelSelectOverlay.classList.add("hidden");
			startRun(index, false);
		});
		levelButtonsEl.appendChild(button);
	});
}

function createEngine() {
	engine = Engine.create();
	engine.gravity.y = 1;
	runner = Runner.create();
	Runner.run(runner, engine);
}

function clearWorld() {
	if (runner) {
		Runner.stop(runner);
	}
	if (mouseConstraint && engine) {
		Composite.remove(engine.world, mouseConstraint);
	}
	if (engine) {
		Composite.clear(engine.world, false);
		Engine.clear(engine);
	}

	Array.from(
		gameLayer.querySelectorAll(
			".body, .floating-score, .floating-combo, .trail-dot, .impact-ring",
		),
	).forEach((node) => node.remove());
	bodyToElement = new Map();
	destroyedBodies = new WeakSet();
	enemies = [];
	blocks = [];
	activeProjectiles = [];
	bird = null;
	slingshotConstraint = null;
	mouseConstraint = null;
	gameMouse = null;
}

function startRun(levelIndex = 0, showSelect = false) {
	clearWorld();
	currentLevelIndex = levelIndex;
	currentBirdQueue = [...LEVELS[currentLevelIndex].birds];
	birdsRemaining = currentBirdQueue.length;
	score = 0;
	comboCount = 1;
	comboTimer = 0;
	isFired = false;
	frameCount = 0;
	stopTimer = 0;
	cameraX = 0;
	gameState = "playing";
	lastResult = null;
	createEngine();
	createEnvironment();
	createLevel();
	setupMouse();
	setupCollisions();
	createBird();
	updateHUD();
	addStatus("Drag, launch, and trigger abilities with Space.", "info");
	pauseOverlay.classList.add("hidden");
	endScreen.classList.add("hidden");
	levelSelectOverlay.classList.toggle("hidden", !showSelect);
}

function createEnvironment() {
	const groundHeight = Math.max(GAME_HEIGHT - GROUND_Y, 100);
	const ground = Bodies.rectangle(
		WORLD_WIDTH / 2,
		GROUND_Y + groundHeight / 2,
		WORLD_WIDTH * 2,
		groundHeight,
		{
			isStatic: true,
			label: "ground",
		},
	);
	createDOMElement(ground, "ground", WORLD_WIDTH * 2, groundHeight);

	const slingW = 22;
	const slingH = 160;
	const slingBase = Bodies.rectangle(
		SLING_X,
		SLING_Y + slingH / 2,
		slingW,
		slingH,
		{
			isStatic: true,
			label: "slingshot",
			isSensor: true,
		},
	);
	createDOMElement(slingBase, "slingshot", slingW, slingH);
	Composite.add(engine.world, [ground, slingBase]);
}

function createLevel() {
	const level = LEVELS[currentLevelIndex];
	objectiveTextEl.textContent = level.objective;
	level.build(GROUND_Y);
	levelLabelEl.textContent = `${currentLevelIndex + 1} / ${LEVELS.length}`;
}

function buildTower(centerX, bottomY, lowerMaterial, upperMaterial) {
	const pillarW = 30;
	const pillarH = 88;

	addBlock(
		centerX - 48,
		bottomY - pillarH / 2,
		pillarW,
		pillarH,
		lowerMaterial,
	);
	addBlock(
		centerX + 48,
		bottomY - pillarH / 2,
		pillarW,
		pillarH,
		lowerMaterial,
	);
	addBlock(centerX, bottomY - pillarH - 16, 138, 28, upperMaterial);
	addPig(centerX, bottomY - 24);

	const midY = bottomY - pillarH - 36;
	addBlock(centerX - 30, midY - pillarH / 2, pillarW, pillarH, lowerMaterial);
	addBlock(centerX + 30, midY - pillarH / 2, pillarW, pillarH, lowerMaterial);
	addBlock(centerX, midY - pillarH - 14, 106, 26, upperMaterial);
	addPig(centerX, midY - 20);
}

function createBird() {
	const nextType = currentBirdQueue.shift();
	if (!nextType) {
		bird = null;
		birdsRemaining = 0;
		updateHUD();
		updateBirdPanel(null);
		return;
	}

	currentBirdType = nextType;
	currentBirdAbilityUsed = false;
	birdsRemaining = currentBirdQueue.length + 1;
	const config = BIRD_TYPES[nextType];
	bird = Bodies.circle(SLING_X, SLING_Y, config.radius, {
		restitution: config.restitution,
		density: config.density,
		friction: 0.5,
		label: "bird",
		collisionFilter: { category: 0x0002 },
	});
	bird.customType = nextType;
	bird.hasAbility = typeof config.useAbility === "function";
	createDOMElement(
		bird,
		`bird ${config.cssClass}`,
		config.radius * 2,
		config.radius * 2,
	);

	slingshotConstraint = Constraint.create({
		pointA: { x: SLING_X, y: SLING_Y },
		bodyB: bird,
		stiffness: 0.05,
		damping: 0.015,
		length: 10,
	});

	Composite.add(engine.world, [bird, slingshotConstraint]);
	activeProjectiles = [bird];
	isFired = false;
	stopTimer = 0;
	slingshotBand.style.display = "block";
	updateHUD();
	updateBirdPanel(nextType);
}

function createDOMElement(body, className, width, height) {
	const el = document.createElement("div");
	el.className = `body ${className}`;
	el.style.width = `${width}px`;
	el.style.height = `${height}px`;
	gameLayer.appendChild(el);
	bodyToElement.set(body, { element: el, width, height });
	return el;
}

function addBlock(x, y, width, height, typeClass = "block") {
	const props = {
		restitution: 0.18,
		friction: 0.6,
		label: "block",
		collisionFilter: { category: 0x0001 },
	};

	if (typeClass === "glass") {
		props.density = 0.0005;
		props.label = "glass";
	} else if (typeClass === "stone") {
		props.density = 0.0058;
		props.label = "stone";
	} else if (typeClass === "crate") {
		props.density = 0.0018;
		props.label = "crate";
	}

	const block = Bodies.rectangle(x, y, width, height, props);
	blocks.push(block);
	createDOMElement(block, typeClass, width, height);
	Composite.add(engine.world, block);
	return block;
}

function addPig(x, y) {
	const radius = 18;
	const pig = Bodies.circle(x, y, radius, {
		restitution: 0.42,
		density: 0.002,
		friction: 0.5,
		label: "pig",
		collisionFilter: { category: 0x0001 },
	});
	enemies.push(pig);
	createDOMElement(pig, "pig", radius * 2, radius * 2);
	Composite.add(engine.world, pig);
	return pig;
}

function setupMouse() {
	gameMouse = Mouse.create(gameContainer);
	mouseConstraint = MouseConstraint.create(engine, {
		mouse: gameMouse,
		constraint: {
			stiffness: 0.12,
			render: { visible: false },
		},
		collisionFilter: {
			mask: 0x0002,
		},
	});

	Composite.add(engine.world, mouseConstraint);

	Events.on(mouseConstraint, "enddrag", (event) => {
		if (gameState !== "playing") {
			return;
		}
		if (event.body === bird && !isFired) {
			isFired = true;
			bird.collisionFilter.category = 0x0001;
			updateBirdPanel(currentBirdType);
			addStatus("Bird launched. Press Space to trigger its ability.", "info");
		}
	});
}

function setupCollisions() {
	Events.on(engine, "collisionStart", (event) => {
		if (gameState !== "playing") {
			return;
		}

		event.pairs.forEach((pair) => {
			const { bodyA, bodyB } = pair;
			const relVelX = bodyA.velocity.x - bodyB.velocity.x;
			const relVelY = bodyA.velocity.y - bodyB.velocity.y;
			const speedScale = Math.sqrt(relVelX * relVelX + relVelY * relVelY);
			if (speedScale < 3.2) {
				return;
			}

			addImpactBurst(
				pair.collision.supports[0].x,
				pair.collision.supports[0].y,
			);
			checkDamage(bodyA, speedScale, bodyB.mass, bodyB.label === "bird");
			checkDamage(bodyB, speedScale, bodyA.mass, bodyA.label === "bird");
		});
	});
}

function checkDamage(body, impactVelocity, collidingMass, hitByBird) {
	if (!body || body.isStatic || !body.label || destroyedBodies.has(body)) {
		return;
	}

	const effMass = collidingMass === Infinity ? 12 : collidingMass;
	const effectiveImpact = impactVelocity * (effMass / 5);

	if (body.label === "pig" && effectiveImpact > 4.5) {
		destroyBody(body, enemies);
		addScore(hitByBird ? 650 : 500, body, "Pig down");
		return;
	}

	if (body.label === "glass" && effectiveImpact > 2.7) {
		destroyBody(body, blocks);
		addScore(120, body);
		return;
	}

	if (body.label === "crate" && effectiveImpact > 5.2) {
		destroyBody(body, blocks);
		addScore(90, body);
		return;
	}

	if (body.label === "block" && effectiveImpact > 7.5) {
		destroyBody(body, blocks);
		addScore(60, body);
		return;
	}

	if (body.label === "stone" && effectiveImpact > 13.5) {
		destroyBody(body, blocks);
		addScore(130, body);
	}
}

function destroyBody(body, arrayList) {
	if (!bodyToElement.has(body) || destroyedBodies.has(body)) {
		return;
	}

	destroyedBodies.add(body);
	const index = arrayList.indexOf(body);
	if (index > -1) {
		arrayList.splice(index, 1);
	}

	activeProjectiles = activeProjectiles.filter(
		(projectile) => projectile !== body,
	);
	if (bird === body) {
		bird = null;
	}

	Composite.remove(engine.world, body);
	const domData = bodyToElement.get(body);
	if (domData) {
		const el = domData.element;
		el.style.transition = "opacity 0.2s ease, transform 0.2s ease";
		el.style.opacity = "0";
		el.style.transform = `${el.style.transform} scale(1.7)`;
		setTimeout(() => {
			if (el.parentNode) {
				el.parentNode.removeChild(el);
			}
		}, 220);
		bodyToElement.delete(body);
	}
}

function addScore(points, body = null, label = "") {
	comboCount = comboTimer > 0 ? Math.min(comboCount + 1, 8) : 1;
	comboTimer = 120;
	const comboBonus =
		comboCount > 1 ? Math.round(points * ((comboCount - 1) * 0.12)) : 0;
	const total = points + comboBonus;
	score += total;

	if (score > bestScore) {
		bestScore = score;
		localStorage.setItem(STORAGE_KEY, String(bestScore));
	}

	scoreEl.textContent = score;
	bestScoreEl.textContent = bestScore;
	comboEl.textContent = `x${comboCount}`;
	scoreEl.style.transform = "scale(1.12)";
	setTimeout(() => {
		scoreEl.style.transform = "scale(1)";
	}, 160);

	if (body) {
		spawnFloatingText(
			body.position.x,
			body.position.y,
			`+${total}`,
			"floating-score",
		);
		if (comboBonus > 0) {
			spawnFloatingText(
				body.position.x + 26,
				body.position.y - 12,
				`${label || "Combo"} +${comboBonus}`,
				"floating-combo",
			);
		}
	}
}

function spawnFloatingText(x, y, text, className) {
	const el = document.createElement("div");
	el.className = className;
	el.textContent = text;
	el.style.left = `${x}px`;
	el.style.top = `${y}px`;
	gameLayer.appendChild(el);
	setTimeout(() => {
		if (el.parentNode) {
			el.parentNode.removeChild(el);
		}
	}, 1100);
}

function addImpactBurst(x, y) {
	const ring = document.createElement("div");
	ring.className = "impact-ring";
	ring.style.left = `${x}px`;
	ring.style.top = `${y}px`;
	gameLayer.appendChild(ring);
	setTimeout(() => {
		if (ring.parentNode) {
			ring.parentNode.removeChild(ring);
		}
	}, 380);
}

function addStatus(text, tone = "info") {
	statusMessageEl.textContent = text;
	statusMessageEl.style.color =
		tone === "danger"
			? "var(--danger)"
			: tone === "ability"
				? "#fff2b3"
				: "var(--text-soft)";
}

function updateHUD() {
	birdsCountEl.textContent = birdsRemaining;
	scoreEl.textContent = score;
	bestScoreEl.textContent = bestScore;
	comboEl.textContent = `x${comboCount}`;
}

function updateBirdPanel(typeKey) {
	if (!typeKey) {
		birdTypeNameEl.textContent = "Out of birds";
		birdTypeDescEl.textContent = "Hope the collapse finishes the job.";
		birdTypeBadgeEl.textContent = "Empty";
		return;
	}

	const config = BIRD_TYPES[typeKey];
	birdTypeNameEl.textContent = config.name;
	birdTypeDescEl.textContent = config.description;
	birdTypeBadgeEl.textContent = currentBirdAbilityUsed
		? config.badgeUsed
		: config.badgeReady;
}

function togglePause() {
	if (gameState === "ended") {
		return;
	}

	if (gameState === "paused") {
		gameState = "playing";
		Runner.run(runner, engine);
		pauseOverlay.classList.add("hidden");
		addStatus("Back in action.", "info");
		return;
	}

	gameState = "paused";
	Runner.stop(runner);
	pauseOverlay.classList.remove("hidden");
	addStatus("Paused. Resume when you're ready.", "info");
}

function handleKeydown(event) {
	if (event.code === "Space") {
		event.preventDefault();
		triggerBirdAbility();
	} else if (event.code === "KeyP") {
		togglePause();
	} else if (event.code === "KeyR") {
		startRun(currentLevelIndex, false);
	} else if (event.code === "KeyL") {
		levelSelectOverlay.classList.remove("hidden");
		togglePauseIfPlaying();
	}
}

function togglePauseIfPlaying() {
	if (gameState === "playing") {
		togglePause();
	}
}

function triggerBirdAbility() {
	if (!bird || !isFired || currentBirdAbilityUsed || gameState !== "playing") {
		return;
	}

	const config = BIRD_TYPES[currentBirdType];
	if (!config || typeof config.useAbility !== "function") {
		addStatus("This bird keeps it simple. No ability on this one.", "info");
		currentBirdAbilityUsed = true;
		updateBirdPanel(currentBirdType);
		return;
	}

	currentBirdAbilityUsed = true;
	updateBirdPanel(currentBirdType);
	config.useAbility(bird);
}

function nextTurn() {
	if (bird && bodyToElement.has(bird)) {
		destroyBody(bird, []);
		bird = null;
	}

	birdsRemaining = currentBirdQueue.length;
	updateHUD();
	if (birdsRemaining > 0 && enemies.length > 0) {
		createBird();
		stopTimer = 0;
		addStatus("New bird up. Line up your next shot.", "info");
	}
}

function handleNextLevel() {
	if (lastResult === "lose") {
		startRun(currentLevelIndex, false);
		return;
	}

	if (currentLevelIndex < LEVELS.length - 1) {
		startRun(currentLevelIndex + 1, false);
		return;
	}

	levelSelectOverlay.classList.remove("hidden");
	startRun(0, true);
}

function endGame(result) {
	gameState = "ended";
	lastResult = result;
	Runner.stop(runner);
	endScreen.classList.remove("hidden");
	finalScoreEl.textContent = score;
	finalBestScoreEl.textContent = bestScore;

	if (result === "win") {
		const finalStage = currentLevelIndex === LEVELS.length - 1;
		endTitleEl.textContent = finalStage
			? "Campaign Cleared!"
			: "Level Cleared!";
		addStatus(
			finalStage
				? "Full run complete. Pick another stage or restart the gauntlet."
				: "Stage clear. Push into the next one.",
			"ability",
		);
		nextLevelButton.textContent = finalStage ? "Level Select" : "Next Level";
		nextLevelButton.classList.remove("hidden");
	} else {
		endTitleEl.textContent = "Level Failed!";
		addStatus(
			"No birds left. Try a different angle or a different stage.",
			"danger",
		);
		nextLevelButton.textContent = "Retry Stage";
		nextLevelButton.classList.remove("hidden");
	}
}

function renderLoop() {
	frameCount += 1;

	if (gameState !== "paused") {
		updateCamera();
		updateDOMBodies();
		updateSlingshotBand();
		updatePowerMeter();
		updateProjectiles();
		updateComboDecay();
		checkWinLoss();
	}

	requestAnimationFrame(renderLoop);
}

function updateCamera() {
	const cameraTargetBody =
		activeProjectiles.find(
			(projectile) => bodyToElement.has(projectile) && projectile.speed > 1,
		) || bird;
	if (cameraTargetBody && isFired) {
		const targetX = Math.max(0, cameraTargetBody.position.x - GAME_WIDTH / 3);
		cameraX += (targetX - cameraX) * 0.09;
		cameraX = Math.min(cameraX, WORLD_WIDTH - GAME_WIDTH);
	} else {
		cameraX += (0 - cameraX) * 0.08;
		cameraX = Math.max(0, cameraX);
	}

	gameLayer.style.transform = `translateX(${-cameraX}px)`;
	if (gameMouse) {
		Mouse.setOffset(gameMouse, { x: cameraX, y: 0 });
	}
}

function updateDOMBodies() {
	bodyToElement.forEach((domData, body) => {
		const x = body.position.x - domData.width / 2;
		const y = body.position.y - domData.height / 2;
		domData.element.style.transform = `translate(${x}px, ${y}px) rotate(${body.angle}rad)`;
	});
}

function updateSlingshotBand() {
	if (!bird || !slingshotConstraint) {
		slingshotBand.style.display = "none";
		return;
	}

	if (!isFired) {
		const px = slingshotConstraint.pointA.x;
		const py = slingshotConstraint.pointA.y;
		const dx = bird.position.x - px;
		const dy = bird.position.y - py;
		const dist = Math.sqrt(dx * dx + dy * dy);
		const angle = Math.atan2(dy, dx);
		slingshotBand.style.display = "block";
		slingshotBand.style.left = `${px}px`;
		slingshotBand.style.top = `${py}px`;
		slingshotBand.style.width = `${dist}px`;
		slingshotBand.style.transform = `rotate(${angle}rad)`;
		return;
	}

	if (bird.position.x > SLING_X - 15 || bird.velocity.x < -2) {
		Composite.remove(engine.world, slingshotConstraint);
		slingshotConstraint = null;
		slingshotBand.style.display = "none";
	}
}

function updatePowerMeter() {
	if (!bird || isFired) {
		powerFillEl.style.width = "0%";
		return;
	}

	const distance = Vector.magnitude(
		Vector.sub(bird.position, { x: SLING_X, y: SLING_Y }),
	);
	const fill = Math.min(100, (distance / 150) * 100);
	powerFillEl.style.width = `${fill}%`;
}

function updateProjectiles() {
	if (!isFired) {
		return;
	}

	activeProjectiles = activeProjectiles.filter((projectile) =>
		bodyToElement.has(projectile),
	);
	activeProjectiles.forEach((projectile, index) => {
		if (frameCount % 4 === index % 4 && projectile.speed > 2.5) {
			const dot = document.createElement("div");
			dot.className = "trail-dot";
			dot.style.left = `${projectile.position.x}px`;
			dot.style.top = `${projectile.position.y}px`;
			gameLayer.appendChild(dot);
			setTimeout(() => {
				if (dot.parentNode) {
					dot.parentNode.removeChild(dot);
				}
			}, 650);
		}
	});

	const moving = activeProjectiles.some(
		(projectile) =>
			projectile.speed > 0.7 || Math.abs(projectile.angularVelocity) > 0.05,
	);
	const outOfBounds = activeProjectiles.every(
		(projectile) =>
			projectile.position.x > WORLD_WIDTH + 100 ||
			projectile.position.y > GAME_HEIGHT + 240 ||
			projectile.position.x < -140,
	);

	if (!moving || outOfBounds) {
		stopTimer += 1;
		if (stopTimer > 96 || outOfBounds) {
			nextTurn();
		}
	} else {
		stopTimer = 0;
	}
}

function updateComboDecay() {
	if (comboTimer > 0) {
		comboTimer -= 1;
		return;
	}

	if (comboCount !== 1) {
		comboCount = 1;
		comboEl.textContent = "x1";
	}
}

function checkWinLoss() {
	if (gameState !== "playing") {
		return;
	}

	if (enemies.length === 0) {
		gameState = "waiting";
		setTimeout(() => endGame("win"), 1100);
		return;
	}

	if (birdsRemaining === 0 && !bird) {
		const unstableBlocks = blocks.some((block) => block.speed > 0.9);
		if (!unstableBlocks) {
			gameState = "waiting";
			setTimeout(() => endGame("lose"), 1200);
		}
	}
}

window.onload = () => {
	setTimeout(init, 50);
};

let resizeTimer;
window.addEventListener("resize", () => {
	clearTimeout(resizeTimer);
	resizeTimer = setTimeout(() => location.reload(), 250);
});
