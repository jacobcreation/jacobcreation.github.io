import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.179.1/build/three.module.js";

const canvas = document.querySelector("#scene");
const speedEl = document.querySelector("#speed");
const scoreEl = document.querySelector("#drift");
const bestEl = document.querySelector("#best");
const wantedEl = document.querySelector("#boost");
const healthEl = document.querySelector("#health");
const healthMeterFillEl = document.querySelector("#health-meter-fill");
const distanceEl = document.querySelector("#distance");
const fuelEl = document.querySelector("#fuel");
const comboMultiplierEl = document.querySelector("#combo-multiplier");
const handbrakeStatusEl = document.querySelector("#handbrake-status");
const objectiveEl = document.querySelector("#objective");
const pursuitEl = document.querySelector("#combo");
const statusPill = document.querySelector("#status-pill");
const navForm = document.querySelector("#nav-form");
const navSearchEl = document.querySelector("#nav-search");
const navTitleEl = document.querySelector("#nav-title");
const navHintEl = document.querySelector("#nav-hint");
const overlay = document.querySelector("#overlay");
const overlayKickerEl = document.querySelector("#overlay-kicker");
const overlayTitleEl = document.querySelector("#overlay-title");
const overlayBodyEl = document.querySelector("#overlay-body");
const respawnButton = document.querySelector("#respawn-button");
const driveJoystick = document.querySelector("#drive-joystick");
const driveJoystickKnob = document.querySelector("#drive-joystick-knob");
const boostButton = document.querySelector("#boost-button");
const handbrakeButton = document.querySelector("#handbrake-button");
const pauseButton = document.querySelector("#pause-button");
const resetButton = document.querySelector("#reset-button");
const LOCAL_WORLD_SAVE_KEY = "dustline-world-save-v1";
const CLOUD_WORLD_APP = "dustline-driver";
const CLOUD_WORLD_KEY = "current-world";

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x8590a4, 120, 420);

const camera = new THREE.PerspectiveCamera(
	60,
	window.innerWidth / window.innerHeight,
	0.1,
	900,
);
camera.position.set(0, 8, 15);

scene.add(new THREE.AmbientLight(0xc8d3ef, 1.25));

const sun = new THREE.DirectionalLight(0xfff3cf, 2.2);
sun.position.set(120, 140, 40);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -180;
sun.shadow.camera.right = 180;
sun.shadow.camera.top = 180;
sun.shadow.camera.bottom = -180;
scene.add(sun);

const sky = new THREE.Mesh(
	new THREE.SphereGeometry(650, 32, 16),
	new THREE.ShaderMaterial({
		side: THREE.BackSide,
		uniforms: {
			topColor: { value: new THREE.Color(0x97a9d8) },
			bottomColor: { value: new THREE.Color(0xd6a77d) },
		},
		vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
		fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition + vec3(0.0, 120.0, 0.0)).y;
        gl_FragColor = vec4(mix(bottomColor, topColor, max(h, 0.0)), 1.0);
      }
    `,
	}),
);
scene.add(sky);

const world = new THREE.Group();
scene.add(world);

const CHUNK_SIZE = 120;
const ACTIVE_CHUNK_RADIUS = 1;
const ROAD_WIDTH = 26;
const SIDEWALK_WIDTH = 8;
const LANE_OFFSET = 5.5;
const STATIC_DAMAGE_START = 9;
const STATIC_DAMAGE_SCALE = 0.2;
const STATIC_DAMAGE_COOLDOWN = 0.75;
const STATIC_DAMAGE_MAX = 24;
const TRAFFIC_DAMAGE_START = 11;
const TRAFFIC_DAMAGE_SCALE = 0.18;
const TRAFFIC_DAMAGE_MAX = 28;
const STATIC_PUSH_RESOLVE = 0.7;
const TRAFFIC_PUSH_PLAYER = 0.45;
const TRAFFIC_PUSH_OTHER = 0.2;
const TRAFFIC_BUMP_IMPULSE = 9;
const TRAFFIC_BUMP_DAMPING = 4.5;
const TRAFFIC_LANE_RETURN = 3.5;
const PEDESTRIAN_DAMAGE = 4;
const PLAYER_RADIUS = 1.7;
const TRAFFIC_RADIUS = 1.9;
const POLICE_RADIUS = 2;
const PEDESTRIAN_RADIUS = 0.8;
const PICKUP_RADIUS = 1.15;
const chunkMap = new Map();
const dustBursts = [];
const trafficCars = [];
const pedestrians = [];
const policeCars = [];
const pickups = [];
const destinationSearchRadius = 5;

const up = new THREE.Vector3(0, 1, 0);
const cameraTarget = new THREE.Vector3();
const cameraPosition = new THREE.Vector3();
const chaseOffset = new THREE.Vector3();
const forwardVec = new THREE.Vector3();
const rightVec = new THREE.Vector3();
const previousCarPosition = new THREE.Vector3();

const materials = {
	asphalt: new THREE.MeshStandardMaterial({ color: 0x34383f, roughness: 0.95 }),
	sidewalk: new THREE.MeshStandardMaterial({ color: 0xb5b6ba, roughness: 1 }),
	lot: new THREE.MeshStandardMaterial({ color: 0x5a6c76, roughness: 1 }),
	grass: new THREE.MeshStandardMaterial({ color: 0x5f8d59, roughness: 1 }),
	buildingA: new THREE.MeshStandardMaterial({
		color: 0x9ba7b6,
		roughness: 0.92,
	}),
	buildingB: new THREE.MeshStandardMaterial({
		color: 0xc7b49d,
		roughness: 0.92,
	}),
	buildingC: new THREE.MeshStandardMaterial({
		color: 0x7a8894,
		roughness: 0.92,
	}),
	glass: new THREE.MeshStandardMaterial({
		color: 0xa9d0f0,
		emissive: 0x29405c,
		emissiveIntensity: 0.25,
		metalness: 0.35,
		roughness: 0.2,
	}),
	treeTrunk: new THREE.MeshStandardMaterial({ color: 0x6b4c32, roughness: 1 }),
	treeLeaves: new THREE.MeshStandardMaterial({ color: 0x4d7a4b, roughness: 1 }),
	bench: new THREE.MeshStandardMaterial({ color: 0x6d4a2f, roughness: 1 }),
	lamp: new THREE.MeshStandardMaterial({
		color: 0xd5d7db,
		metalness: 0.4,
		roughness: 0.45,
	}),
	stripe: new THREE.MeshStandardMaterial({ color: 0xf4e6ad, roughness: 0.9 }),
	playerCar: new THREE.MeshStandardMaterial({
		color: 0xf94144,
		metalness: 0.25,
		roughness: 0.42,
	}),
	policeCar: new THREE.MeshStandardMaterial({
		color: 0x11131a,
		metalness: 0.35,
		roughness: 0.4,
	}),
	trafficCar: new THREE.MeshStandardMaterial({
		color: 0x4db3ff,
		metalness: 0.22,
		roughness: 0.48,
	}),
	trafficAlt: new THREE.MeshStandardMaterial({
		color: 0xff9f1c,
		metalness: 0.22,
		roughness: 0.48,
	}),
	pedestrian: new THREE.MeshStandardMaterial({
		color: 0xf0d1b7,
		roughness: 0.9,
	}),
	shirtA: new THREE.MeshStandardMaterial({ color: 0x46aaf0, roughness: 0.8 }),
	shirtB: new THREE.MeshStandardMaterial({ color: 0xff6b6b, roughness: 0.8 }),
	shirtC: new THREE.MeshStandardMaterial({ color: 0x7bd389, roughness: 0.8 }),
	dust: new THREE.MeshBasicMaterial({
		color: 0xd9dce2,
		transparent: true,
		opacity: 0.3,
	}),
};

const keys = {
	forward: false,
	backward: false,
	left: false,
	right: false,
	boost: false,
	handbrake: false,
};

const touchDrive = {
	active: false,
	pointerId: null,
	steer: 0,
	throttle: 0,
};

const touchButtons = {
	boost: false,
	handbrake: false,
};

const state = {
	velocity: new THREE.Vector3(),
	heading: 0,
	steer: 0,
	grounded: true,
	bodyPitch: 0,
	bodyRoll: 0,
	score: 0,
	bestScore: Number(localStorage.getItem("dustline-best-score") || 0),
	health: 100,
	fuel: 100,
	distance: 0,
	wanted: 0,
	crimeTimer: 0,
	pursuitCapture: 0,
	comboMultiplier: 1,
	comboTime: 0,
	handbrakeTime: 0,
	refuelTime: 0,
	staticDamageCooldown: 0,
	staticCollisionActive: false,
	navigation: null,
	gameOver: false,
	paused: false,
	deathMessage: "",
};

let lastWorldSaveAt = 0;
let cloudWorldLoaded = false;
let cloudWorldSaveInFlight = false;

bestEl.textContent = Math.round(state.bestScore);

function hash2d(x, z) {
	const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
	return s - Math.floor(s);
}

function createRng(seedX, seedZ) {
	let seed = Math.floor(hash2d(seedX, seedZ) * 2147483647) || 1;
	return () => {
		seed = (seed * 48271) % 2147483647;
		return (seed - 1) / 2147483646;
	};
}

function chunkKey(cx, cz) {
	return `${cx},${cz}`;
}

function getRoadCenter(value) {
	return Math.round(value / CHUNK_SIZE) * CHUNK_SIZE;
}

function getGroundHeight() {
	return 0;
}

function withArticle(label) {
	const article = /^[aeiou]/i.test(label) ? "an" : "a";
	return `${article} ${label}`;
}

function createDustBurst(x, y, z, size, color = 0xd9dce2) {
	if (dustBursts.length > 16) return;
	const puff = new THREE.Mesh(
		new THREE.SphereGeometry(size, 8, 8),
		materials.dust.clone(),
	);
	puff.material.color.setHex(color);
	puff.position.set(x, y, z);
	puff.scale.setScalar(0.45);
	scene.add(puff);
	dustBursts.push({
		mesh: puff,
		life: 0.7,
		vx: (Math.random() - 0.5) * 1.5,
		vy: 0.4 + Math.random() * 0.8,
		vz: (Math.random() - 0.5) * 1.5,
	});
}

function updateDust(delta) {
	for (let i = dustBursts.length - 1; i >= 0; i -= 1) {
		const burst = dustBursts[i];
		burst.life -= delta;
		burst.mesh.position.x += burst.vx * delta;
		burst.mesh.position.y += burst.vy * delta;
		burst.mesh.position.z += burst.vz * delta;
		const scale = 1 + (0.7 - burst.life) * 2.4;
		burst.mesh.scale.setScalar(Math.max(0.2, scale));
		burst.mesh.material.opacity = Math.max(0, burst.life * 0.45);
		if (burst.life <= 0) {
			scene.remove(burst.mesh);
			burst.mesh.geometry.dispose();
			burst.mesh.material.dispose();
			dustBursts.splice(i, 1);
		}
	}
}

function awardScore(basePoints, message = "") {
	const earned = basePoints * state.comboMultiplier;
	state.score += earned;
	if (message && !state.paused) {
		statusPill.textContent = `${message} x${state.comboMultiplier.toFixed(1)}`;
	}
}

function setOverlay(visible, kicker = "", title = "", bodyText = "") {
	overlay.classList.toggle("is-visible", visible);
	overlayKickerEl.textContent = kicker;
	overlayTitleEl.textContent = title;
	overlayBodyEl.textContent = bodyText;
}

function setPaused(paused) {
	if (state.gameOver) return;
	state.paused = paused;
	if (paused) {
		saveDustlineWorld({ force: true });
		Object.keys(keys).forEach((key) => {
			keys[key] = false;
		});
		touchButtons.boost = false;
		touchButtons.handbrake = false;
		syncDriveJoystick(true);
		syncTouchActionButtons();
		setOverlay(
			true,
			"Paused",
			"Drive paused",
			"Press P to jump back into the city.",
		);
		statusPill.textContent = "Simulation paused";
		pursuitEl.textContent = "Paused";
	} else {
		setOverlay(false, "", "", "");
		statusPill.textContent =
			state.wanted > 0.05
				? "Back on the run"
				: state.fuel < 12
					? "Watch the tank"
					: "Back on the road";
	}
}

function togglePause() {
	setPaused(!state.paused);
}

function syncDriveJoystick(reset = false) {
	if (!driveJoystickKnob) return;
	if (reset) {
		touchDrive.active = false;
		touchDrive.pointerId = null;
		touchDrive.steer = 0;
		touchDrive.throttle = 0;
		driveJoystickKnob.style.transform = "translate(-50%, -50%)";
		return;
	}

	const maxOffset = 36;
	driveJoystickKnob.style.transform = `translate(calc(-50% + ${touchDrive.steer * maxOffset}px), calc(-50% + ${-touchDrive.throttle * maxOffset}px))`;
}

function syncTouchActionButtons() {
	boostButton?.classList.toggle("is-active", touchButtons.boost);
	handbrakeButton?.classList.toggle("is-active", touchButtons.handbrake);
}

function setTouchButtonState(buttonKey, active) {
	touchButtons[buttonKey] = active;
	syncTouchActionButtons();
}

function updateDriveJoystickFromPoint(clientX, clientY) {
	if (!driveJoystick) return;
	const base = driveJoystick.querySelector(".touch-joystick__base");
	const rect = base.getBoundingClientRect();
	const centerX = rect.left + rect.width / 2;
	const centerY = rect.top + rect.height / 2;
	const radius = rect.width * 0.34;
	let dx = clientX - centerX;
	let dy = clientY - centerY;
	const distance = Math.hypot(dx, dy);
	if (distance > radius) {
		const scale = radius / distance;
		dx *= scale;
		dy *= scale;
	}
	touchDrive.steer = THREE.MathUtils.clamp(dx / radius, -1, 1);
	touchDrive.throttle = THREE.MathUtils.clamp(-dy / radius, -1, 1);
	syncDriveJoystick();
}

function setupMobileDrivingControls() {
	if (!driveJoystick || !driveJoystickKnob) return;

	const joystickBase = driveJoystick.querySelector(".touch-joystick__base");
	joystickBase.addEventListener("pointerdown", (event) => {
		event.preventDefault();
		touchDrive.active = true;
		touchDrive.pointerId = event.pointerId;
		joystickBase.setPointerCapture(event.pointerId);
		updateDriveJoystickFromPoint(event.clientX, event.clientY);
	});

	joystickBase.addEventListener("pointermove", (event) => {
		if (!touchDrive.active || event.pointerId !== touchDrive.pointerId) return;
		event.preventDefault();
		updateDriveJoystickFromPoint(event.clientX, event.clientY);
	});

	const endJoystick = (event) => {
		if (!touchDrive.active || event.pointerId !== touchDrive.pointerId) return;
		touchDrive.active = false;
		touchDrive.pointerId = null;
		touchDrive.steer = 0;
		touchDrive.throttle = 0;
		syncDriveJoystick();
	};

	joystickBase.addEventListener("pointerup", endJoystick);
	joystickBase.addEventListener("pointercancel", endJoystick);

	const bindHoldButton = (button, key) => {
		if (!button) return;
		const release = () => setTouchButtonState(key, false);
		button.addEventListener("pointerdown", (event) => {
			event.preventDefault();
			button.setPointerCapture(event.pointerId);
			setTouchButtonState(key, true);
		});
		button.addEventListener("pointerup", release);
		button.addEventListener("pointercancel", release);
		button.addEventListener("lostpointercapture", release);
	};

	bindHoldButton(boostButton, "boost");
	bindHoldButton(handbrakeButton, "handbrake");
	pauseButton?.addEventListener("click", () => togglePause());
	resetButton?.addEventListener("click", () => resetGame());
}

function addStaticCollider(
	colliders,
	x,
	z,
	radius,
	height = 30,
	label = "object",
) {
	colliders.push({ x, z, radius, height, label });
}

function activeStaticColliders(x, z) {
	const nearby = [];
	const centerChunkX = Math.round(x / CHUNK_SIZE);
	const centerChunkZ = Math.round(z / CHUNK_SIZE);
	for (let dz = -1; dz <= 1; dz += 1) {
		for (let dx = -1; dx <= 1; dx += 1) {
			const chunk = chunkMap.get(
				chunkKey(centerChunkX + dx, centerChunkZ + dz),
			);
			if (!chunk) continue;
			for (const collider of chunk.colliders) {
				nearby.push(collider);
			}
		}
	}
	return nearby;
}

function activeGasStations(x, z) {
	const nearby = [];
	const centerChunkX = Math.round(x / CHUNK_SIZE);
	const centerChunkZ = Math.round(z / CHUNK_SIZE);
	for (let dz = -1; dz <= 1; dz += 1) {
		for (let dx = -1; dx <= 1; dx += 1) {
			const chunk = chunkMap.get(
				chunkKey(centerChunkX + dx, centerChunkZ + dz),
			);
			if (!chunk) continue;
			for (const station of chunk.gasStations) {
				nearby.push(station);
			}
		}
	}
	return nearby;
}

function addDestination(destinations, x, z, type, label, aliases = []) {
	destinations.push({
		x,
		z,
		type,
		label,
		aliases: [label, type, ...aliases].map((entry) => entry.toLowerCase()),
	});
}

function createBox(group, x, y, z, sx, sy, sz, material, castShadow = true) {
	const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
	mesh.position.set(x, y, z);
	mesh.castShadow = castShadow;
	mesh.receiveShadow = true;
	group.add(mesh);
	return mesh;
}

function buildBuilding(
	group,
	colliders,
	x,
	z,
	width,
	depth,
	height,
	material,
	glassTint,
) {
	createBox(group, x, height / 2, z, width, height, depth, material);
	const pane = new THREE.Mesh(
		new THREE.BoxGeometry(width * 0.68, Math.max(6, height * 0.68), 0.35),
		materials.glass,
	);
	pane.material = materials.glass.clone();
	pane.material.color.setHex(glassTint);
	pane.position.set(x, Math.max(4, height * 0.52), z + depth / 2 + 0.15);
	group.add(pane);
	addStaticCollider(
		colliders,
		x,
		z,
		Math.max(width, depth) * 0.52,
		30,
		"building",
	);
}

function buildPark(
	group,
	colliders,
	destinations,
	centerX,
	centerZ,
	width,
	depth,
	rng,
) {
	const grass = new THREE.Mesh(
		new THREE.BoxGeometry(width, 0.2, depth),
		materials.grass,
	);
	grass.position.set(centerX, 0.1, centerZ);
	grass.receiveShadow = true;
	group.add(grass);

	for (let i = 0; i < 5; i += 1) {
		const tx = centerX - width / 2 + 10 + rng() * (width - 20);
		const tz = centerZ - depth / 2 + 10 + rng() * (depth - 20);
		const trunk = new THREE.Mesh(
			new THREE.CylinderGeometry(0.5, 0.6, 4.5, 8),
			materials.treeTrunk,
		);
		trunk.position.set(tx, 2.25, tz);
		group.add(trunk);

		const leaves = new THREE.Mesh(
			new THREE.SphereGeometry(2.8 + rng() * 0.8, 8, 8),
			materials.treeLeaves,
		);
		leaves.position.set(tx, 5.5, tz);
		group.add(leaves);

		addStaticCollider(colliders, tx, tz, 2, 30, "tree");
	}

	for (let i = 0; i < 2; i += 1) {
		const bx = centerX - 8 + i * 16;
		const bz = centerZ + depth * 0.2;
		createBox(group, bx, 0.45, bz, 4.2, 0.3, 1.1, materials.bench);
		createBox(group, bx - 1.8, 0.8, bz, 0.2, 0.9, 1.1, materials.lamp);
		createBox(group, bx + 1.8, 0.8, bz, 0.2, 0.9, 1.1, materials.lamp);
		addStaticCollider(colliders, bx, bz, 2.5, 2, "bench");
	}

	addDestination(destinations, centerX, centerZ, "park", "Park", [
		"green space",
		"garden",
	]);
}

function buildParkingLot(
	group,
	colliders,
	destinations,
	centerX,
	centerZ,
	width,
	depth,
	rng,
) {
	const lot = new THREE.Mesh(
		new THREE.BoxGeometry(width, 0.08, depth),
		materials.asphalt,
	);
	lot.position.set(centerX, 0.04, centerZ);
	lot.receiveShadow = true;
	group.add(lot);

	const stripeMaterial = materials.stripe.clone();
	stripeMaterial.color.setHex(0xece8d9);
	for (let i = -2; i <= 2; i += 1) {
		const stripe = new THREE.Mesh(
			new THREE.BoxGeometry(0.2, 0.1, depth - 8),
			stripeMaterial,
		);
		stripe.position.set(centerX + i * 4.6, 0.1, centerZ);
		group.add(stripe);
	}

	for (let i = 0; i < 3; i += 1) {
		const colorIndex = 8 + i + Math.floor(rng() * 4);
		const parked = createTrafficCar(colorIndex);
		parked.speed = 0;
		parked.axis = "x";
		parked.dir = 1;
		parked.car.position.set(
			centerX - 8 + i * 8,
			0,
			centerZ - depth * 0.15 + rng() * 4,
		);
		parked.car.rotation.y = Math.PI / 2;
		group.add(parked.car);
		addStaticCollider(
			colliders,
			parked.car.position.x,
			parked.car.position.z,
			2.2,
			2.5,
			"parked car",
		);
	}
	addDestination(destinations, centerX, centerZ, "parking lot", "Parking Lot", [
		"parking",
		"lot",
	]);
}

function buildPlaza(
	group,
	colliders,
	destinations,
	centerX,
	centerZ,
	width,
	depth,
	rng,
) {
	const ground = new THREE.Mesh(
		new THREE.BoxGeometry(width, 0.12, depth),
		materials.sidewalk,
	);
	ground.position.set(centerX, 0.06, centerZ);
	ground.receiveShadow = true;
	group.add(ground);

	const fountainBase = createBox(
		group,
		centerX,
		0.45,
		centerZ,
		7,
		0.6,
		7,
		materials.buildingC,
		false,
	);
	fountainBase.receiveShadow = true;
	const fountainWater = new THREE.Mesh(
		new THREE.CylinderGeometry(2.2, 2.6, 0.45, 18),
		materials.glass.clone(),
	);
	fountainWater.material.emissiveIntensity = 0.12;
	fountainWater.position.set(centerX, 0.9, centerZ);
	group.add(fountainWater);
	addStaticCollider(colliders, centerX, centerZ, 3.8, 2, "fountain");

	for (let i = 0; i < 4; i += 1) {
		const angle = (i / 4) * Math.PI * 2;
		const bx = centerX + Math.cos(angle) * 10;
		const bz = centerZ + Math.sin(angle) * 10;
		createBox(group, bx, 0.45, bz, 4.2, 0.3, 1.1, materials.bench);
		addStaticCollider(colliders, bx, bz, 2.2, 2, "bench");
	}

	for (let i = 0; i < 5; i += 1) {
		const tx = centerX - width / 2 + 8 + rng() * (width - 16);
		const tz = centerZ - depth / 2 + 8 + rng() * (depth - 16);
		const trunk = new THREE.Mesh(
			new THREE.CylinderGeometry(0.42, 0.52, 4, 8),
			materials.treeTrunk,
		);
		trunk.position.set(tx, 2, tz);
		group.add(trunk);
		const leaves = new THREE.Mesh(
			new THREE.SphereGeometry(2.4 + rng() * 0.6, 8, 8),
			materials.treeLeaves,
		);
		leaves.position.set(tx, 5, tz);
		group.add(leaves);
		addStaticCollider(colliders, tx, tz, 1.9, 30, "tree");
	}

	addDestination(destinations, centerX, centerZ, "plaza", "Plaza", [
		"square",
		"fountain",
	]);
}

function buildGasStation(
	group,
	colliders,
	gasStations,
	destinations,
	centerX,
	centerZ,
	rng,
) {
	const forecourt = new THREE.Mesh(
		new THREE.BoxGeometry(34, 0.08, 26),
		materials.asphalt,
	);
	forecourt.position.set(centerX, 0.04, centerZ);
	forecourt.receiveShadow = true;
	group.add(forecourt);

	const shopMaterial = materials.buildingB.clone();
	shopMaterial.color.offsetHSL(0.02, 0.04, 0.06);
	createBox(group, centerX - 8, 4, centerZ + 7, 14, 8, 10, shopMaterial);

	const canopyMaterial = materials.glass.clone();
	canopyMaterial.color.setHex(0xdce9ff);
	canopyMaterial.emissiveIntensity = 0.18;
	createBox(group, centerX + 7, 5.3, centerZ - 1, 16, 0.8, 12, canopyMaterial);
	for (const px of [centerX + 2, centerX + 12]) {
		for (const pz of [centerZ - 4, centerZ + 2]) {
			createBox(group, px, 2.5, pz, 0.7, 5, 0.7, materials.lamp);
			createBox(group, px, 1.2, pz, 1.1, 2.2, 1.8, materials.playerCar.clone());
			addStaticCollider(colliders, px, pz, 1.3, 3, "pump");
		}
	}

	createBox(
		group,
		centerX - 1.5,
		2.6,
		centerZ + 10,
		3.6,
		3.8,
		0.3,
		materials.stripe,
	);
	addStaticCollider(colliders, centerX - 8, centerZ + 7, 8, 8, "gas station");
	gasStations.push({ x: centerX + 7, z: centerZ - 1, radius: 9.5 });
	addDestination(
		destinations,
		centerX + 7,
		centerZ - 1,
		"gas station",
		"Gas Station",
		["gas", "fuel", "station"],
	);
}

function buildWarehouse(
	group,
	colliders,
	destinations,
	centerX,
	centerZ,
	width,
	depth,
	rng,
) {
	const warehouseMaterial = materials.buildingC.clone();
	warehouseMaterial.color.offsetHSL(0, -0.05, -0.08);
	createBox(group, centerX, 7, centerZ, width, 14, depth, warehouseMaterial);
	createBox(
		group,
		centerX,
		2.8,
		centerZ + depth / 2 + 0.2,
		8,
		5.5,
		0.3,
		materials.lamp,
	);

	for (let i = 0; i < 4; i += 1) {
		const crateX = centerX - width * 0.28 + i * 5.2;
		const crateZ = centerZ - depth * 0.34 + (i % 2) * 5.5;
		createBox(group, crateX, 1.1, crateZ, 2.4, 2.2, 2.4, materials.bench);
		addStaticCollider(colliders, crateX, crateZ, 1.6, 2.5, "crate stack");
	}

	addStaticCollider(
		colliders,
		centerX,
		centerZ,
		Math.max(width, depth) * 0.5,
		16,
		"warehouse",
	);
	addDestination(destinations, centerX, centerZ, "warehouse", "Warehouse", [
		"industrial",
		"depot",
	]);
}

function buildMall(group, colliders, destinations, centerX, centerZ, rng) {
	const shellMaterial = materials.buildingA.clone();
	shellMaterial.color.offsetHSL(-0.02, -0.05, 0.1);
	createBox(group, centerX, 9, centerZ, 52, 18, 38, shellMaterial);

	const entranceGlass = new THREE.Mesh(
		new THREE.BoxGeometry(18, 9, 0.4),
		materials.glass.clone(),
	);
	entranceGlass.position.set(centerX, 6.5, centerZ + 19.2);
	entranceGlass.material.color.setHex(0xd7ebff);
	entranceGlass.material.emissiveIntensity = 0.22;
	group.add(entranceGlass);

	const signMaterial = new THREE.MeshStandardMaterial({
		color: 0xffd166,
		emissive: 0x62450f,
		emissiveIntensity: 0.42,
		roughness: 0.35,
	});
	createBox(
		group,
		centerX,
		13.4,
		centerZ + 19.4,
		14,
		2.2,
		0.4,
		signMaterial,
		false,
	);

	for (let i = 0; i < 6; i += 1) {
		const banner = createBox(
			group,
			centerX - 18 + i * 7.2,
			7.5,
			centerZ + 19.25,
			3.2,
			5.4,
			0.2,
			materials.glass.clone(),
			false,
		);
		banner.material.color.setHSL((0.08 * i + rng() * 0.1) % 1, 0.7, 0.68);
	}

	buildParkingLot(
		group,
		colliders,
		destinations,
		centerX,
		centerZ - 28,
		48,
		18,
		rng,
	);
	addStaticCollider(colliders, centerX, centerZ, 24, 18, "mall");
	addDestination(destinations, centerX, centerZ, "mall", "Mall", [
		"shopping center",
		"shopping",
	]);
}

function buildLot(
	group,
	colliders,
	gasStations,
	destinations,
	centerX,
	centerZ,
	rng,
	district,
	lotType = "mixed",
) {
	const roll = rng();
	if (lotType === "mall") {
		buildMall(group, colliders, destinations, centerX, centerZ, rng);
		return;
	}
	if (lotType === "service") {
		if (roll > 0.5) {
			buildGasStation(
				group,
				colliders,
				gasStations,
				destinations,
				centerX,
				centerZ,
				rng,
			);
		} else {
			buildParkingLot(
				group,
				colliders,
				destinations,
				centerX,
				centerZ,
				34,
				34,
				rng,
			);
		}
		return;
	}
	if (lotType === "industrial") {
		if (roll > 0.35) {
			buildWarehouse(
				group,
				colliders,
				destinations,
				centerX,
				centerZ,
				28 + rng() * 6,
				24 + rng() * 8,
				rng,
			);
		} else {
			buildParkingLot(
				group,
				colliders,
				destinations,
				centerX,
				centerZ,
				34,
				34,
				rng,
			);
		}
		return;
	}
	if (lotType === "plaza") {
		if (roll > 0.42) {
			buildPlaza(group, colliders, destinations, centerX, centerZ, 34, 34, rng);
		} else {
			buildPark(group, colliders, destinations, centerX, centerZ, 34, 34, rng);
		}
		return;
	}

	if (district === "downtown" && roll > 0.72) {
		buildPlaza(group, colliders, destinations, centerX, centerZ, 34, 34, rng);
		return;
	}
	if (district === "commercial" && roll > 0.7) {
		buildParkingLot(
			group,
			colliders,
			destinations,
			centerX,
			centerZ,
			34,
			34,
			rng,
		);
		return;
	}
	if (district === "residential" && roll > 0.74) {
		buildPark(group, colliders, destinations, centerX, centerZ, 34, 34, rng);
		return;
	}

	const width = district === "downtown" ? 20 + rng() * 9 : 16 + rng() * 10;
	const depth = district === "downtown" ? 20 + rng() * 9 : 16 + rng() * 10;
	const heightBase =
		district === "downtown" ? 28 : district === "commercial" ? 20 : 14;
	const height = heightBase + rng() * (district === "downtown" ? 34 : 20);
	const materialChoices = [
		materials.buildingA,
		materials.buildingB,
		materials.buildingC,
	];
	const material =
		materialChoices[Math.floor(rng() * materialChoices.length)].clone();
	material.color.offsetHSL(
		(rng() - 0.5) * 0.04,
		(rng() - 0.5) * 0.08,
		(rng() - 0.5) * 0.08,
	);
	const glassTint = [0xa9d0f0, 0xd8e4ef, 0x9fc3df, 0xb8dbf2][
		Math.floor(rng() * 4)
	];
	buildBuilding(
		group,
		colliders,
		centerX,
		centerZ,
		width,
		depth,
		height,
		material,
		glassTint,
	);
}

function buildStreetLights(group, colliders, chunkCenterX, chunkCenterZ) {
	const offsets = [
		[-ROAD_WIDTH * 0.6, -ROAD_WIDTH * 0.6],
		[ROAD_WIDTH * 0.6, -ROAD_WIDTH * 0.6],
		[-ROAD_WIDTH * 0.6, ROAD_WIDTH * 0.6],
		[ROAD_WIDTH * 0.6, ROAD_WIDTH * 0.6],
	];

	for (const [ox, oz] of offsets) {
		const x = chunkCenterX + ox;
		const z = chunkCenterZ + oz;
		const pole = new THREE.Mesh(
			new THREE.CylinderGeometry(0.22, 0.28, 8, 10),
			materials.lamp,
		);
		pole.position.set(x, 4, z);
		group.add(pole);

		const arm = new THREE.Mesh(
			new THREE.BoxGeometry(1.8, 0.14, 0.14),
			materials.lamp,
		);
		arm.position.set(x + 0.8, 7.7, z);
		group.add(arm);

		addStaticCollider(colliders, x, z, 0.8, 8, "streetlight");
	}
}

function createChunk(cx, cz) {
	const key = chunkKey(cx, cz);
	if (chunkMap.has(key)) return;

	const rng = createRng(cx + 900, cz - 2300);
	const group = new THREE.Group();
	const colliders = [];
	const gasStations = [];
	const destinations = [];
	const centerX = cx * CHUNK_SIZE;
	const centerZ = cz * CHUNK_SIZE;
	const distanceFromCenter = Math.abs(cx) + Math.abs(cz);
	const district =
		distanceFromCenter <= 1
			? "downtown"
			: Math.abs(cx) % 3 === 0 || Math.abs(cz) % 3 === 0
				? "commercial"
				: distanceFromCenter > 4
					? "industrial"
					: "residential";

	const base = new THREE.Mesh(
		new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE),
		materials.lot,
	);
	base.rotation.x = -Math.PI / 2;
	base.position.set(centerX, -0.02, centerZ);
	base.receiveShadow = true;
	group.add(base);

	const roadX = new THREE.Mesh(
		new THREE.BoxGeometry(CHUNK_SIZE, 0.05, ROAD_WIDTH),
		materials.asphalt,
	);
	roadX.position.set(centerX, 0.025, centerZ);
	roadX.receiveShadow = true;
	group.add(roadX);

	const roadZ = new THREE.Mesh(
		new THREE.BoxGeometry(ROAD_WIDTH, 0.05, CHUNK_SIZE),
		materials.asphalt,
	);
	roadZ.position.set(centerX, 0.025, centerZ);
	roadZ.receiveShadow = true;
	group.add(roadZ);

	const sidewalkX = new THREE.Mesh(
		new THREE.BoxGeometry(CHUNK_SIZE, 0.14, ROAD_WIDTH + SIDEWALK_WIDTH * 2),
		materials.sidewalk,
	);
	sidewalkX.position.set(centerX, 0.02, centerZ);
	group.add(sidewalkX);

	const sidewalkZ = new THREE.Mesh(
		new THREE.BoxGeometry(ROAD_WIDTH + SIDEWALK_WIDTH * 2, 0.14, CHUNK_SIZE),
		materials.sidewalk,
	);
	sidewalkZ.position.set(centerX, 0.02, centerZ);
	group.add(sidewalkZ);

	for (let i = -2; i <= 2; i += 1) {
		const stripeX = new THREE.Mesh(
			new THREE.BoxGeometry(8, 0.12, 0.35),
			materials.stripe,
		);
		stripeX.position.set(centerX + i * 16, 0.11, centerZ);
		group.add(stripeX);

		const stripeZ = new THREE.Mesh(
			new THREE.BoxGeometry(0.35, 0.12, 8),
			materials.stripe,
		);
		stripeZ.position.set(centerX, 0.11, centerZ + i * 16);
		group.add(stripeZ);
	}

	if (district === "downtown" || district === "commercial") {
		for (let i = -1; i <= 1; i += 1) {
			const median = new THREE.Mesh(
				new THREE.BoxGeometry(1.4, 0.18, 10),
				materials.sidewalk,
			);
			median.position.set(
				centerX + i * 12,
				0.12,
				centerZ + ROAD_WIDTH * 0.5 + 4,
			);
			group.add(median);
		}
	}

	const quadrants = [
		{ x: centerX - 31, z: centerZ - 31 },
		{ x: centerX + 31, z: centerZ - 31 },
		{ x: centerX - 31, z: centerZ + 31 },
		{ x: centerX + 31, z: centerZ + 31 },
	];

	const specialLayoutRoll = rng();
	let lotTypes;
	if (district === "commercial" && specialLayoutRoll > 0.7) {
		lotTypes = ["mall", "service", "commercial", "commercial"];
	} else if (district === "industrial" && specialLayoutRoll > 0.58) {
		lotTypes = ["industrial", "industrial", "service", "parking"];
	} else if (district === "downtown" && specialLayoutRoll > 0.64) {
		lotTypes = ["downtown", "downtown", "plaza", "commercial"];
	} else {
		lotTypes = quadrants.map(() => district);
		if (district === "residential" && specialLayoutRoll > 0.66) {
			lotTypes[Math.floor(rng() * quadrants.length)] = "plaza";
		}
		if (district === "commercial" && specialLayoutRoll > 0.48) {
			lotTypes[Math.floor(rng() * quadrants.length)] = "service";
		}
	}

	quadrants.forEach((quad, index) => {
		const lotType = lotTypes[index];
		if (lotType === "parking") {
			buildParkingLot(
				group,
				colliders,
				destinations,
				quad.x,
				quad.z,
				34,
				34,
				rng,
			);
			return;
		}
		buildLot(
			group,
			colliders,
			gasStations,
			destinations,
			quad.x,
			quad.z,
			rng,
			district,
			lotType,
		);
	});

	buildStreetLights(group, colliders, centerX, centerZ);
	world.add(group);
	chunkMap.set(key, { group, colliders, gasStations, destinations });
}

function updateChunks(x, z) {
	const centerChunkX = Math.round(x / CHUNK_SIZE);
	const centerChunkZ = Math.round(z / CHUNK_SIZE);
	const keep = new Set();

	for (let dz = -ACTIVE_CHUNK_RADIUS; dz <= ACTIVE_CHUNK_RADIUS; dz += 1) {
		for (let dx = -ACTIVE_CHUNK_RADIUS; dx <= ACTIVE_CHUNK_RADIUS; dx += 1) {
			const cx = centerChunkX + dx;
			const cz = centerChunkZ + dz;
			const key = chunkKey(cx, cz);
			keep.add(key);
			createChunk(cx, cz);
		}
	}

	for (const [key, chunk] of chunkMap.entries()) {
		if (!keep.has(key)) {
			world.remove(chunk.group);
			chunkMap.delete(key);
		}
	}
}

const navigationBeacon = new THREE.Group();
const beaconColumn = new THREE.Mesh(
	new THREE.CylinderGeometry(0.45, 0.45, 20, 12),
	new THREE.MeshBasicMaterial({
		color: 0x8ef0cb,
		transparent: true,
		opacity: 0.24,
	}),
);
beaconColumn.position.y = 10;
navigationBeacon.add(beaconColumn);

const beaconRing = new THREE.Mesh(
	new THREE.TorusGeometry(3, 0.18, 12, 32),
	new THREE.MeshBasicMaterial({ color: 0xffd166 }),
);
beaconRing.rotation.x = Math.PI / 2;
beaconRing.position.y = 0.3;
navigationBeacon.add(beaconRing);
navigationBeacon.visible = false;
scene.add(navigationBeacon);

const destinationSearchIndex = [
	{ type: "gas station", aliases: ["gas station", "gas", "fuel", "station"] },
	{ type: "park", aliases: ["park", "garden", "green space"] },
	{ type: "plaza", aliases: ["plaza", "square", "fountain"] },
	{ type: "mall", aliases: ["mall", "shopping", "shopping center"] },
	{ type: "warehouse", aliases: ["warehouse", "industrial", "depot"] },
	{ type: "parking lot", aliases: ["parking lot", "parking", "lot"] },
];

function findDestinationSearchType(query) {
	const normalized = query.trim().toLowerCase();
	if (!normalized) return null;

	for (const entry of destinationSearchIndex) {
		if (
			entry.aliases.some(
				(alias) => normalized.includes(alias) || alias.includes(normalized),
			)
		) {
			return entry.type;
		}
	}

	return null;
}

function collectDestinationsAround(x, z, radius = destinationSearchRadius) {
	const centerChunkX = Math.round(x / CHUNK_SIZE);
	const centerChunkZ = Math.round(z / CHUNK_SIZE);
	const results = [];

	for (let dz = -radius; dz <= radius; dz += 1) {
		for (let dx = -radius; dx <= radius; dx += 1) {
			const cx = centerChunkX + dx;
			const cz = centerChunkZ + dz;
			createChunk(cx, cz);
			const chunk = chunkMap.get(chunkKey(cx, cz));
			if (!chunk) continue;
			results.push(...chunk.destinations);
		}
	}

	return results;
}

function directionLabelToTarget(dx, dz) {
	const targetHeading = Math.atan2(dx, dz);
	let delta = targetHeading - state.heading;
	delta = Math.atan2(Math.sin(delta), Math.cos(delta));
	const absDelta = Math.abs(delta);

	if (absDelta < Math.PI / 6) return "Ahead";
	if (absDelta > (Math.PI * 5) / 6) return "Behind";
	return delta > 0 ? "Left" : "Right";
}

function clearNavigation(message = "Navigation cleared") {
	state.navigation = null;
	navigationBeacon.visible = false;
	navTitleEl.textContent = "No destination selected";
	navHintEl.textContent =
		"Search a place and the city will mark the nearest one.";
	if (!state.gameOver && !state.paused) {
		statusPill.textContent = message;
	}
}

function setNavigationFromQuery(query) {
	const type = findDestinationSearchType(query);
	if (!type) {
		navTitleEl.textContent = "No match";
		navHintEl.textContent =
			"Try gas station, park, plaza, mall, warehouse, or parking lot.";
		statusPill.textContent = "Search not recognized";
		return;
	}

	const destinations = collectDestinationsAround(
		car.position.x,
		car.position.z,
	);
	const matches = destinations.filter(
		(destination) => destination.type === type,
	);
	if (matches.length === 0) {
		navTitleEl.textContent = "No destination found";
		navHintEl.textContent = `No ${type} found nearby. Drive farther and try again.`;
		statusPill.textContent = `No ${type} nearby`;
		return;
	}

	let nearest = matches[0];
	let bestDistanceSq = Infinity;
	for (const destination of matches) {
		const dx = destination.x - car.position.x;
		const dz = destination.z - car.position.z;
		const distanceSq = dx * dx + dz * dz;
		if (distanceSq < bestDistanceSq) {
			bestDistanceSq = distanceSq;
			nearest = destination;
		}
	}

	state.navigation = {
		...nearest,
		query: query.trim(),
		arrived: false,
	};
	navSearchEl.value = nearest.label;
	navigationBeacon.visible = true;
	navigationBeacon.position.set(nearest.x, 0, nearest.z);
	statusPill.textContent = `Routing to ${nearest.label.toLowerCase()}`;
}

function createCarMesh(bodyMaterial, roofColor) {
	const car = new THREE.Group();
	const body = new THREE.Mesh(
		new THREE.BoxGeometry(2.5, 0.9, 4.8),
		bodyMaterial,
	);
	body.position.y = 1.05;
	body.castShadow = true;
	body.receiveShadow = true;
	car.add(body);

	const roof = new THREE.Mesh(
		new THREE.BoxGeometry(1.8, 0.8, 2.2),
		new THREE.MeshStandardMaterial({
			color: roofColor,
			roughness: 0.3,
			metalness: 0.08,
		}),
	);
	roof.position.set(0, 1.65, -0.1);
	roof.castShadow = true;
	car.add(roof);

	const bumperFront = new THREE.Mesh(
		new THREE.BoxGeometry(2.5, 0.24, 0.25),
		new THREE.MeshStandardMaterial({ color: 0x1b1b1d, roughness: 0.85 }),
	);
	bumperFront.position.set(0, 0.55, 2.34);
	car.add(bumperFront);

	const bumperRear = bumperFront.clone();
	bumperRear.position.z = -2.34;
	car.add(bumperRear);

	const wheelGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.42, 18);
	const wheelMaterial = new THREE.MeshStandardMaterial({
		color: 0x161616,
		roughness: 1,
	});
	const wheelPositions = [
		[-1.3, 0.55, 1.58],
		[1.3, 0.55, 1.58],
		[-1.3, 0.55, -1.58],
		[1.3, 0.55, -1.58],
	];

	const wheels = [];
	for (const [x, y, z] of wheelPositions) {
		const mount = new THREE.Group();
		mount.position.set(x, y, z);
		car.add(mount);
		const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
		wheel.rotation.z = Math.PI / 2;
		wheel.castShadow = true;
		wheel.receiveShadow = true;
		mount.add(wheel);
		wheels.push({ mount, wheel, isFront: z > 0 });
	}

	return { car, body, wheels };
}

function createPlayerCar() {
	const { car, body, wheels } = createCarMesh(materials.playerCar, 0xfcefdc);
	scene.add(car);
	return { car, body, wheels };
}

const { car, body, wheels } = createPlayerCar();

function createTrafficCar(colorIndex = 0) {
	const bodyMaterial =
		colorIndex % 2 === 0
			? materials.trafficCar.clone()
			: materials.trafficAlt.clone();
	if (colorIndex > 1) {
		bodyMaterial.color.setHSL((colorIndex * 0.14) % 1, 0.75, 0.55);
	}
	const { car, wheels } = createCarMesh(bodyMaterial, 0xe8edf3);
	world.add(car);
	return {
		car,
		wheels,
		axis: "x",
		dir: 1,
		laneCoord: 0,
		speed: 14,
		radius: TRAFFIC_RADIUS,
		bumpVelocity: new THREE.Vector2(),
	};
}

function createPoliceCar() {
	const { car, body, wheels } = createCarMesh(
		materials.policeCar.clone(),
		0xffffff,
	);
	createBox(
		car,
		0,
		2.05,
		0,
		1.3,
		0.18,
		0.5,
		new THREE.MeshStandardMaterial({
			color: 0xd9dce2,
			metalness: 0.35,
			roughness: 0.35,
		}),
		false,
	);
	world.add(car);
	return {
		car,
		body,
		wheels,
		speed: 0,
		heading: 0,
		radius: POLICE_RADIUS,
		active: false,
		sirenTime: Math.random() * Math.PI * 2,
	};
}

function createPedestrian(index) {
	const group = new THREE.Group();
	const head = new THREE.Mesh(
		new THREE.SphereGeometry(0.35, 10, 10),
		materials.pedestrian,
	);
	head.position.y = 1.75;
	group.add(head);

	const shirtMaterials = [materials.shirtA, materials.shirtB, materials.shirtC];
	const torso = new THREE.Mesh(
		new THREE.BoxGeometry(0.7, 0.9, 0.35),
		shirtMaterials[index % shirtMaterials.length],
	);
	torso.position.y = 1.1;
	torso.castShadow = true;
	group.add(torso);

	const leg = new THREE.Mesh(
		new THREE.BoxGeometry(0.18, 0.8, 0.18),
		new THREE.MeshStandardMaterial({ color: 0x2c2f36, roughness: 1 }),
	);
	leg.position.set(-0.14, 0.4, 0);
	leg.castShadow = true;
	group.add(leg);
	const leg2 = leg.clone();
	leg2.position.x = 0.14;
	group.add(leg2);

	world.add(group);
	return {
		group,
		axis: index % 2 === 0 ? "x" : "z",
		dir: index % 3 === 0 ? -1 : 1,
		speed: 1.8 + (index % 5) * 0.22,
		x: 0,
		z: 0,
		radius: PEDESTRIAN_RADIUS,
		respawnAt: 0,
	};
}

function createPickup(type) {
	const group = new THREE.Group();
	const core = new THREE.Mesh(
		new THREE.OctahedronGeometry(0.75, 0),
		new THREE.MeshStandardMaterial({
			color:
				type === "repair"
					? 0x7ef29a
					: type === "cooldown"
						? 0x72d6ff
						: 0xffd166,
			emissive:
				type === "repair"
					? 0x1b6429
					: type === "cooldown"
						? 0x1b5164
						: 0x6f5112,
			emissiveIntensity: 0.7,
			metalness: 0.15,
			roughness: 0.35,
		}),
	);
	core.castShadow = true;
	group.add(core);

	const ring = new THREE.Mesh(
		new THREE.TorusGeometry(1.05, 0.08, 8, 24),
		new THREE.MeshStandardMaterial({
			color: 0xf5f7ff,
			emissive: 0x36414d,
			emissiveIntensity: 0.35,
		}),
	);
	ring.rotation.x = Math.PI / 2;
	group.add(ring);

	world.add(group);
	return {
		group,
		type,
		radius: PICKUP_RADIUS,
		active: true,
		respawnAt: 0,
		pulseOffset: Math.random() * Math.PI * 2,
	};
}

function spawnTrafficCar(vehicle, index) {
	vehicle.bumpVelocity.set(0, 0);
	const roadCenter = getRoadCenter(car.position[index % 2 === 0 ? "z" : "x"]);
	const offsetRoad = roadCenter + ((index % 4) - 1.5) * CHUNK_SIZE;
	if (index % 2 === 0) {
		vehicle.axis = "x";
		vehicle.dir = index % 4 < 2 ? 1 : -1;
		vehicle.laneCoord =
			offsetRoad + (vehicle.dir > 0 ? -LANE_OFFSET : LANE_OFFSET);
		vehicle.car.position.set(
			car.position.x - vehicle.dir * (90 + index * 10),
			0,
			vehicle.laneCoord,
		);
	} else {
		vehicle.axis = "z";
		vehicle.dir = index % 4 < 2 ? 1 : -1;
		vehicle.laneCoord =
			offsetRoad + (vehicle.dir > 0 ? LANE_OFFSET : -LANE_OFFSET);
		vehicle.car.position.set(
			vehicle.laneCoord,
			0,
			car.position.z - vehicle.dir * (90 + index * 10),
		);
	}
	vehicle.speed = 12 + (index % 5) * 2.3;
	vehicle.car.rotation.y =
		vehicle.axis === "x"
			? vehicle.dir > 0
				? Math.PI / 2
				: -Math.PI / 2
			: vehicle.dir > 0
				? 0
				: Math.PI;
}

function spawnPedestrian(ped, index) {
	const blockCenterX =
		getRoadCenter(car.position.x) + ((index % 4) - 1.5) * CHUNK_SIZE;
	const blockCenterZ =
		getRoadCenter(car.position.z) +
		((Math.floor(index / 4) % 4) - 1.5) * CHUNK_SIZE;
	const side = index % 4;
	ped.axis = side < 2 ? "x" : "z";
	ped.dir = side % 2 === 0 ? 1 : -1;
	if (ped.axis === "x") {
		ped.x = blockCenterX - 28 + (index % 3) * 10;
		ped.z =
			blockCenterZ + (side === 0 ? ROAD_WIDTH * 0.75 : -ROAD_WIDTH * 0.75);
	} else {
		ped.x =
			blockCenterX + (side === 2 ? ROAD_WIDTH * 0.75 : -ROAD_WIDTH * 0.75);
		ped.z = blockCenterZ - 28 + (index % 3) * 10;
	}
	ped.group.position.set(ped.x, 0, ped.z);
}

function spawnPickup(pickup, index) {
	const blockCenterX =
		getRoadCenter(car.position.x) + ((index % 4) - 1.5) * CHUNK_SIZE;
	const blockCenterZ =
		getRoadCenter(car.position.z) +
		((Math.floor(index / 4) % 4) - 1.5) * CHUNK_SIZE;
	const side = index % 4;
	const x = blockCenterX + (side < 2 ? 24 - side * 48 : 0);
	const z = blockCenterZ + (side >= 2 ? 24 - (side - 2) * 48 : 0);
	pickup.group.position.set(x, 1.4, z);
	pickup.group.visible = true;
	pickup.active = true;
	pickup.respawnAt = 0;
}

function spawnPoliceCar(police, index) {
	const angle = index * ((Math.PI * 2) / 3) + Math.random() * 0.5;
	const radius = 40 + index * 12;
	police.car.position.set(
		car.position.x + Math.cos(angle) * radius,
		0,
		car.position.z + Math.sin(angle) * radius,
	);
	police.heading = Math.atan2(
		car.position.x - police.car.position.x,
		car.position.z - police.car.position.z,
	);
	police.car.rotation.y = police.heading;
	police.speed = 11 + index * 1.5;
	police.active = true;
}

for (let i = 0; i < 8; i += 1) {
	const vehicle = createTrafficCar(i);
	trafficCars.push(vehicle);
}

for (let i = 0; i < 10; i += 1) {
	pedestrians.push(createPedestrian(i));
}

for (let i = 0; i < 2; i += 1) {
	policeCars.push(createPoliceCar());
}

for (let i = 0; i < 6; i += 1) {
	const type = i % 3 === 0 ? "repair" : i % 3 === 1 ? "cooldown" : "score";
	pickups.push(createPickup(type));
}

function resetTraffic() {
	trafficCars.forEach((vehicle, index) => spawnTrafficCar(vehicle, index));
	pedestrians.forEach((ped, index) => {
		ped.respawnAt = 0;
		spawnPedestrian(ped, index);
		ped.group.visible = true;
	});
	policeCars.forEach((police) => {
		police.active = false;
		police.car.visible = false;
	});
	pickups.forEach((pickup, index) => spawnPickup(pickup, index));
}

function resetGame({ persist = true } = {}) {
	setOverlay(false, "", "", "");
	car.position.set(0, 0, 0);
	state.velocity.set(0, 0, 0);
	state.heading = 0;
	state.steer = 0;
	state.bodyPitch = 0;
	state.bodyRoll = 0;
	state.score = 0;
	state.health = 100;
	state.fuel = 100;
	state.distance = 0;
	state.wanted = 0;
	state.crimeTimer = 0;
	state.pursuitCapture = 0;
	state.comboMultiplier = 1;
	state.comboTime = 0;
	state.handbrakeTime = 0;
	state.refuelTime = 0;
	state.staticDamageCooldown = 0;
	state.staticCollisionActive = false;
	state.navigation = null;
	state.gameOver = false;
	state.paused = false;
	state.deathMessage = "";
	previousCarPosition.copy(car.position);
	respawnButton.classList.remove("is-visible");
	resetTraffic();
	updateChunks(0, 0);
	clearNavigation("City drive reset");
	statusPill.textContent = "City drive reset";
	if (persist) saveDustlineWorld({ force: true });
}

respawnButton.addEventListener("click", () => {
	resetGame();
});

function createDustlineWorldSave() {
	return {
		version: 1,
		app: CLOUD_WORLD_APP,
		updatedAt: Date.now(),
		position: {
			x: Number(car.position.x.toFixed(3)),
			z: Number(car.position.z.toFixed(3)),
		},
		heading: Number(state.heading.toFixed(5)),
		velocity: {
			x: Number(state.velocity.x.toFixed(4)),
			z: Number(state.velocity.z.toFixed(4)),
		},
		score: Math.round(state.score),
		bestScore: Math.round(state.bestScore),
		health: Math.round(state.health * 10) / 10,
		fuel: Math.round(state.fuel * 10) / 10,
		distance: Math.round(state.distance),
		wanted: Math.round(state.wanted * 100) / 100,
		crimeTimer: Math.round(state.crimeTimer * 100) / 100,
		comboMultiplier: Math.round(state.comboMultiplier * 100) / 100,
		comboTime: Math.round(state.comboTime * 100) / 100,
		navigation: state.navigation
			? {
					x: Number(state.navigation.x.toFixed(3)),
					z: Number(state.navigation.z.toFixed(3)),
					type: state.navigation.type || "",
					label: state.navigation.label || "",
					query: state.navigation.query || "",
					arrived: Boolean(state.navigation.arrived),
				}
			: null,
	};
}

function applyDustlineWorldSave(save, source = "save") {
	if (!save || typeof save !== "object" || !save.position) return false;
	const x = Number(save.position.x);
	const z = Number(save.position.z);
	if (!Number.isFinite(x) || !Number.isFinite(z)) return false;

	setOverlay(false, "", "", "");
	car.position.set(x, 0, z);
	state.velocity.set(Number(save.velocity?.x) || 0, 0, Number(save.velocity?.z) || 0);
	state.heading = Number(save.heading) || 0;
	state.steer = 0;
	state.bodyPitch = 0;
	state.bodyRoll = 0;
	state.score = Math.max(0, Number(save.score) || 0);
	state.bestScore = Math.max(state.bestScore, Number(save.bestScore) || 0);
	state.health = THREE.MathUtils.clamp(Number(save.health) || 100, 0, 100);
	state.fuel = THREE.MathUtils.clamp(Number(save.fuel) || 100, 0, 100);
	state.distance = Math.max(0, Number(save.distance) || 0);
	state.wanted = THREE.MathUtils.clamp(Number(save.wanted) || 0, 0, 5);
	state.crimeTimer = Math.max(0, Number(save.crimeTimer) || 0);
	state.pursuitCapture = 0;
	state.comboMultiplier = THREE.MathUtils.clamp(Number(save.comboMultiplier) || 1, 1, 5);
	state.comboTime = Math.max(0, Number(save.comboTime) || 0);
	state.handbrakeTime = 0;
	state.refuelTime = 0;
	state.staticDamageCooldown = 0;
	state.staticCollisionActive = false;
	state.gameOver = false;
	state.paused = false;
	state.deathMessage = "";
	state.navigation = save.navigation && Number.isFinite(Number(save.navigation.x)) && Number.isFinite(Number(save.navigation.z))
		? {
				x: Number(save.navigation.x),
				z: Number(save.navigation.z),
				type: save.navigation.type || "destination",
				label: save.navigation.label || "Saved destination",
				query: save.navigation.query || save.navigation.label || "",
				arrived: Boolean(save.navigation.arrived),
			}
		: null;
	previousCarPosition.copy(car.position);
	respawnButton.classList.remove("is-visible");
	resetTraffic();
	updateChunks(car.position.x, car.position.z);
	if (state.navigation) {
		navSearchEl.value = state.navigation.query || state.navigation.label;
		navigationBeacon.visible = true;
		navigationBeacon.position.set(state.navigation.x, 0, state.navigation.z);
	} else {
		clearNavigation("");
	}
	bestEl.textContent = Math.round(state.bestScore).toString();
	statusPill.textContent = source === "cloud" ? "Account world loaded" : "Saved world loaded";
	updateHud();
	return true;
}

function readLocalDustlineWorld() {
	try {
		return JSON.parse(localStorage.getItem(LOCAL_WORLD_SAVE_KEY) || "null");
	} catch (error) {
		return null;
	}
}

function writeLocalDustlineWorld(save) {
	try {
		localStorage.setItem(LOCAL_WORLD_SAVE_KEY, JSON.stringify(save));
		localStorage.setItem("dustline-best-score", String(Math.round(save.bestScore || state.bestScore)));
	} catch (error) {
		console.warn("Could not save Dustline world locally", error);
	}
}

function saveDustlineWorld({ force = false } = {}) {
	const now = Date.now();
	if (!force && now - lastWorldSaveAt < 12000) return;
	lastWorldSaveAt = now;
	const save = createDustlineWorldSave();
	writeLocalDustlineWorld(save);

	const accounts = window.JacobAccounts;
	if (!accounts || !accounts.isSignedIn || !accounts.isSignedIn() || cloudWorldSaveInFlight) return;
	cloudWorldSaveInFlight = true;
	accounts
		.setData(CLOUD_WORLD_APP, CLOUD_WORLD_KEY, save, {
			label: "Current Dustline world",
			meta: {
				score: save.score,
				bestScore: save.bestScore,
				distance: save.distance,
			},
		})
		.then(() =>
			accounts.saveHighScore(CLOUD_WORLD_APP, save.bestScore, {
				gameName: "Dustline Driver",
				label: "Best drive",
				mode: "endless-city",
				meta: { distance: save.distance },
			}),
		)
		.catch((error) => console.warn("Could not save Dustline world to account", error))
		.finally(() => {
			cloudWorldSaveInFlight = false;
		});
}

async function loadDustlineWorldFromAccount() {
	const accounts = window.JacobAccounts;
	if (cloudWorldLoaded || !accounts || !accounts.isSignedIn || !accounts.isSignedIn()) return;
	cloudWorldLoaded = true;

	try {
		const record = await accounts.getData(CLOUD_WORLD_APP, CLOUD_WORLD_KEY);
		const remote = record && record.value;
		const local = readLocalDustlineWorld();
		if (remote && (!local || Number(remote.updatedAt || 0) > Number(local.updatedAt || 0))) {
			if (applyDustlineWorldSave(remote, "cloud")) {
				writeLocalDustlineWorld(remote);
			}
			return;
		}
		if (local) {
			await accounts.setData(CLOUD_WORLD_APP, CLOUD_WORLD_KEY, local, {
				label: "Current Dustline world",
				meta: { source: "localStorage" },
			});
		}
	} catch (error) {
		if (!/not found/i.test(error.message || "")) {
			console.warn("Could not load Dustline world from account", error);
		}
	}
}

function loadDustlineWorld() {
	const local = readLocalDustlineWorld();
	if (local) applyDustlineWorldSave(local, "local");
	loadDustlineWorldFromAccount();
}

setupMobileDrivingControls();

window.addEventListener("keydown", (event) => {
	if (event.repeat) return;
	const key = event.key.toLowerCase();
	if (key === "w" || key === "arrowup") keys.forward = true;
	if (key === "s" || key === "arrowdown") keys.backward = true;
	if (key === "a" || key === "arrowleft") keys.left = true;
	if (key === "d" || key === "arrowright") keys.right = true;
	if (key === "shift") keys.boost = true;
	if (key === " ") keys.handbrake = true;
	if (key === "p") togglePause();
	if (key === "r") resetGame();
});

window.addEventListener("keyup", (event) => {
	const key = event.key.toLowerCase();
	if (key === "w" || key === "arrowup") keys.forward = false;
	if (key === "s" || key === "arrowdown") keys.backward = false;
	if (key === "a" || key === "arrowleft") keys.left = false;
	if (key === "d" || key === "arrowright") keys.right = false;
	if (key === "shift") keys.boost = false;
	if (key === " ") keys.handbrake = false;
});

navForm.addEventListener("submit", (event) => {
	event.preventDefault();

	const query = navSearchEl.value.trim();
	if (!query) {
		clearNavigation();
		return;
	}
	setNavigationFromQuery(query);
});

function addCrime(amount, message) {
	state.wanted = Math.min(5, state.wanted + amount);
	state.crimeTimer = 18;
	state.comboTime = Math.max(state.comboTime, 3 + amount * 1.4);
	state.comboMultiplier = Math.min(5, state.comboMultiplier + amount * 0.25);
	statusPill.textContent = message;
}

function resolveStaticCollisions() {
	const colliders = activeStaticColliders(car.position.x, car.position.z);
	let strongestHit = 0;
	let strongestLabel = "object";
	let touchingStaticCollider = false;

	for (const collider of colliders) {
		const dx = car.position.x - collider.x;
		const dz = car.position.z - collider.z;
		const minDistance = PLAYER_RADIUS + collider.radius;
		const distanceSq = dx * dx + dz * dz;
		if (distanceSq === 0 || distanceSq >= minDistance * minDistance) continue;
		touchingStaticCollider = true;

		const distance = Math.sqrt(distanceSq);
		const nx = dx / distance;
		const nz = dz / distance;
		const push = minDistance - distance;
		car.position.x += nx * push * STATIC_PUSH_RESOLVE;
		car.position.z += nz * push * STATIC_PUSH_RESOLVE;

		const normalSpeed = state.velocity.x * nx + state.velocity.z * nz;
		const hitSpeed = Math.max(0, -normalSpeed);
		strongestHit = Math.max(strongestHit, hitSpeed);
		if (hitSpeed >= strongestHit) {
			strongestLabel = collider.label || "object";
		}
		if (hitSpeed > 0.35) {
			// Remove the into-the-wall component so the car scrubs along surfaces
			// instead of bouncing sideways or getting launched back.
			state.velocity.x += nx * hitSpeed;
			state.velocity.z += nz * hitSpeed;
			state.velocity.multiplyScalar(0.94);
		}
	}

	if (
		touchingStaticCollider &&
		!state.staticCollisionActive &&
		strongestHit > STATIC_DAMAGE_START &&
		state.staticDamageCooldown <= 0
	) {
		const collisionDamage = Math.min(
			STATIC_DAMAGE_MAX,
			(strongestHit - STATIC_DAMAGE_START) * STATIC_DAMAGE_SCALE,
		);
		state.health = Math.max(0, state.health - collisionDamage);
		state.staticDamageCooldown = STATIC_DAMAGE_COOLDOWN;
		createDustBurst(car.position.x, 0.8, car.position.z, 1.1);
		statusPill.textContent =
			strongestHit > 10 ? "Hard collision" : "Clipped a city prop";
		if (state.health <= 0) {
			state.deathMessage = `You hit ${withArticle(strongestLabel)} too hard`;
		}
	}

	state.staticCollisionActive = touchingStaticCollider;
}

function updateTraffic(delta) {
	for (let i = 0; i < trafficCars.length; i += 1) {
		const vehicle = trafficCars[i];
		vehicle.car.position.x += vehicle.bumpVelocity.x * delta;
		vehicle.car.position.z += vehicle.bumpVelocity.y * delta;
		vehicle.bumpVelocity.multiplyScalar(
			Math.max(0, 1 - TRAFFIC_BUMP_DAMPING * delta),
		);

		if (vehicle.axis === "x") {
			vehicle.car.position.x += vehicle.dir * vehicle.speed * delta;
			vehicle.car.position.z = THREE.MathUtils.lerp(
				vehicle.car.position.z,
				vehicle.laneCoord,
				Math.min(1, TRAFFIC_LANE_RETURN * delta),
			);
			if (
				Math.abs(vehicle.car.position.x - car.position.x) >
				CHUNK_SIZE * 3.2
			) {
				spawnTrafficCar(vehicle, i);
			}
		} else {
			vehicle.car.position.z += vehicle.dir * vehicle.speed * delta;
			vehicle.car.position.x = THREE.MathUtils.lerp(
				vehicle.car.position.x,
				vehicle.laneCoord,
				Math.min(1, TRAFFIC_LANE_RETURN * delta),
			);
			if (
				Math.abs(vehicle.car.position.z - car.position.z) >
				CHUNK_SIZE * 3.2
			) {
				spawnTrafficCar(vehicle, i);
			}
		}

		const heading =
			vehicle.axis === "x"
				? vehicle.dir > 0
					? Math.PI / 2
					: -Math.PI / 2
				: vehicle.dir > 0
					? 0
					: Math.PI;
		vehicle.car.rotation.y = heading;
		for (const wheel of vehicle.wheels) {
			wheel.wheel.rotation.x -= vehicle.speed * delta * 1.6;
		}

		const dx = car.position.x - vehicle.car.position.x;
		const dz = car.position.z - vehicle.car.position.z;
		const minDistance = PLAYER_RADIUS + vehicle.radius;
		const distanceSq = dx * dx + dz * dz;
		if (distanceSq > 0 && distanceSq < minDistance * minDistance) {
			const distance = Math.sqrt(distanceSq);
			const nx = dx / distance;
			const nz = dz / distance;
			const overlap = minDistance - distance;
			car.position.x += nx * overlap * TRAFFIC_PUSH_PLAYER;
			car.position.z += nz * overlap * TRAFFIC_PUSH_PLAYER;
			vehicle.car.position.x -= nx * overlap * TRAFFIC_PUSH_OTHER;
			vehicle.car.position.z -= nz * overlap * TRAFFIC_PUSH_OTHER;

			const relativeVelocityX =
				state.velocity.x -
				(vehicle.axis === "x" ? vehicle.dir * vehicle.speed : 0);
			const relativeVelocityZ =
				state.velocity.z -
				(vehicle.axis === "z" ? vehicle.dir * vehicle.speed : 0);
			const relativeNormalSpeed =
				relativeVelocityX * nx + relativeVelocityZ * nz;
			const relativeSpeed = Math.max(0, -relativeNormalSpeed);
			if (relativeSpeed > 0.2) {
				state.velocity.x += nx * Math.min(relativeSpeed, 10);
				state.velocity.z += nz * Math.min(relativeSpeed, 10);
				vehicle.bumpVelocity.x -=
					nx * Math.min(relativeSpeed * TRAFFIC_BUMP_IMPULSE, 18);
				vehicle.bumpVelocity.y -=
					nz * Math.min(relativeSpeed * TRAFFIC_BUMP_IMPULSE, 18);
			}
			state.velocity.multiplyScalar(0.88);
			if (relativeSpeed > TRAFFIC_DAMAGE_START) {
				const collisionDamage = Math.min(
					TRAFFIC_DAMAGE_MAX,
					(relativeSpeed - TRAFFIC_DAMAGE_START) * TRAFFIC_DAMAGE_SCALE,
				);
				state.health = Math.max(0, state.health - collisionDamage);
				awardScore(15, "Traffic hit");
				addCrime(1, "Traffic collision reported");
				if (state.health <= 0) {
					state.deathMessage = "You totaled the car in traffic";
				}
			}
		}
	}
}

function updatePedestrians(delta, time) {
	for (let i = 0; i < pedestrians.length; i += 1) {
		const ped = pedestrians[i];
		if (ped.respawnAt > 0) {
			ped.respawnAt -= delta;
			if (ped.respawnAt <= 0) {
				spawnPedestrian(ped, i);
				ped.group.visible = true;
			}
			continue;
		}

		if (ped.axis === "x") {
			ped.x += ped.dir * ped.speed * delta;
		} else {
			ped.z += ped.dir * ped.speed * delta;
		}

		if (
			Math.abs(ped.x - car.position.x) > CHUNK_SIZE * 3.2 ||
			Math.abs(ped.z - car.position.z) > CHUNK_SIZE * 3.2
		) {
			spawnPedestrian(ped, i);
		}

		ped.group.position.set(ped.x, 0, ped.z);
		ped.group.rotation.y =
			ped.axis === "x"
				? ped.dir > 0
					? Math.PI / 2
					: -Math.PI / 2
				: ped.dir > 0
					? 0
					: Math.PI;
		ped.group.position.y = Math.sin(time * 7 + i) * 0.03;

		const dx = car.position.x - ped.x;
		const dz = car.position.z - ped.z;
		if (dx * dx + dz * dz < (PLAYER_RADIUS + ped.radius) ** 2) {
			ped.group.visible = false;
			ped.respawnAt = 8;
			createDustBurst(ped.x, 1.1, ped.z, 0.7, 0xc8cdd8);
			state.health = Math.max(0, state.health - PEDESTRIAN_DAMAGE);
			awardScore(50, "Major chaos");
			addCrime(2, "Pedestrian hit. Police alerted");
		}
	}
}

function updatePickups(delta, time) {
	for (let i = 0; i < pickups.length; i += 1) {
		const pickup = pickups[i];
		if (!pickup.active) {
			pickup.respawnAt -= delta;
			if (pickup.respawnAt <= 0) {
				spawnPickup(pickup, i);
			}
			continue;
		}

		if (
			Math.abs(pickup.group.position.x - car.position.x) > CHUNK_SIZE * 3.2 ||
			Math.abs(pickup.group.position.z - car.position.z) > CHUNK_SIZE * 3.2
		) {
			spawnPickup(pickup, i);
			continue;
		}

		pickup.group.rotation.y += delta * 1.8;
		pickup.group.position.y =
			1.25 + Math.sin(time * 3.4 + pickup.pulseOffset) * 0.25;

		const dx = car.position.x - pickup.group.position.x;
		const dz = car.position.z - pickup.group.position.z;
		if (dx * dx + dz * dz > (PLAYER_RADIUS + pickup.radius) ** 2) continue;

		if (pickup.type === "repair") {
			state.health = Math.min(100, state.health + 28);
			awardScore(20, "Repair cache");
		} else if (pickup.type === "cooldown") {
			state.wanted = Math.max(0, state.wanted - 1.6);
			state.crimeTimer = Math.max(0, state.crimeTimer - 5);
			awardScore(25, "Signal jammer");
		} else {
			state.comboTime = Math.max(state.comboTime, 5);
			state.comboMultiplier = Math.min(5, state.comboMultiplier + 0.45);
			awardScore(40, "Stash collected");
		}

		createDustBurst(
			pickup.group.position.x,
			1.1,
			pickup.group.position.z,
			0.8,
			0xf0f3ff,
		);
		pickup.active = false;
		pickup.group.visible = false;
		pickup.respawnAt = 12 + Math.random() * 8;
	}
}

function updatePolice(delta) {
	const activeWanted = state.wanted > 0.05 && !state.gameOver;
	if (activeWanted) {
		policeCars.forEach((police, index) => {
			if (!police.active) {
				spawnPoliceCar(police, index);
				police.car.visible = true;
			}
		});
	} else {
		policeCars.forEach((police) => {
			police.active = false;
			police.car.visible = false;
		});
		state.pursuitCapture = Math.max(0, state.pursuitCapture - delta * 2);
	}

	let nearestPolice = Infinity;
	for (const police of policeCars) {
		if (!police.active) continue;

		const dx = car.position.x - police.car.position.x;
		const dz = car.position.z - police.car.position.z;
		const targetHeading = Math.atan2(dx, dz);
		let turn = targetHeading - police.heading;
		turn = Math.atan2(Math.sin(turn), Math.cos(turn));
		police.heading += THREE.MathUtils.clamp(turn, -1.35 * delta, 1.35 * delta);
		police.speed = THREE.MathUtils.lerp(
			police.speed,
			14 + state.wanted * 2.2,
			delta * 1.4,
		);
		police.car.position.x += Math.sin(police.heading) * police.speed * delta;
		police.car.position.z += Math.cos(police.heading) * police.speed * delta;
		police.car.rotation.y = police.heading;
		police.sirenTime += delta * 8;
		nearestPolice = Math.min(nearestPolice, Math.hypot(dx, dz));

		const flash = (Math.sin(police.sirenTime) + 1) * 0.5;
		police.body.material.color.setRGB(
			0.08 + flash * 0.1,
			0.08,
			0.1 + (1 - flash) * 0.18,
		);
		for (const wheel of police.wheels) {
			wheel.wheel.rotation.x -= police.speed * delta * 1.8;
		}

		const distance = Math.hypot(dx, dz);
		if (distance < PLAYER_RADIUS + police.radius + 0.5) {
			state.gameOver = true;
			state.velocity.set(0, 0, 0);
			state.pursuitCapture = 1;
			state.deathMessage = "You were caught by police";
			objectiveEl.textContent = state.deathMessage;
			pursuitEl.textContent = "Lost";
			statusPill.textContent = state.deathMessage;
			setOverlay(
				true,
				"Busted",
				"Pursuit failed",
				"Respawn to get back behind the wheel.",
			);
			respawnButton.classList.add("is-visible");
			break;
		}

		if (distance > CHUNK_SIZE * 4) {
			spawnPoliceCar(police, Math.floor(Math.random() * policeCars.length));
		}
	}

	if (activeWanted && nearestPolice < Infinity) {
		pursuitEl.textContent = `Close ${nearestPolice.toFixed(0)}m`;
	} else {
		pursuitEl.textContent = state.gameOver ? "Lost" : "Idle";
	}
}

function syncCarBody(forwardSpeed, delta, throttleInput) {
	state.bodyPitch = THREE.MathUtils.lerp(
		state.bodyPitch,
		THREE.MathUtils.clamp(-throttleInput * 0.035, -0.045, 0.03),
		delta * 4,
	);
	state.bodyRoll = THREE.MathUtils.lerp(
		state.bodyRoll,
		THREE.MathUtils.clamp(state.steer * forwardSpeed * 0.0075, -0.12, 0.12),
		delta * 4,
	);
}

function updateHud() {
	speedEl.textContent = Math.round(
		Math.hypot(state.velocity.x, state.velocity.z) * 3.6,
	).toString();
	scoreEl.textContent = Math.round(state.score).toString();
	wantedEl.textContent = state.wanted.toFixed(1);
	const roundedHealth = Math.round(state.health);
	healthEl.textContent = roundedHealth.toString();
	healthMeterFillEl.style.transform = `scaleX(${THREE.MathUtils.clamp(state.health / 100, 0, 1)})`;
	healthMeterFillEl.style.background =
		state.health > 60
			? "linear-gradient(90deg, #52d681, #8ef0cb)"
			: state.health > 30
				? "linear-gradient(90deg, #ffb347, #ffd166)"
				: "linear-gradient(90deg, #ff5d5d, #ff866e)";
	distanceEl.textContent = Math.round(state.distance).toString();
	fuelEl.textContent = Math.round(state.fuel).toString();
	comboMultiplierEl.textContent = `x${state.comboMultiplier.toFixed(1)}`;
	handbrakeStatusEl.textContent = keys.handbrake ? "Sliding" : "Ready";

	if (state.score > state.bestScore) {
		state.bestScore = state.score;
		localStorage.setItem(
			"dustline-best-score",
			String(Math.round(state.bestScore)),
		);
		bestEl.textContent = Math.round(state.bestScore).toString();
		saveDustlineWorld({ force: true });
	}

	if (state.gameOver) {
		objectiveEl.textContent = state.deathMessage || "Drive ended";
	} else if (state.paused) {
		objectiveEl.textContent = "Paused. Press P to resume the drive";
	} else if (state.navigation) {
		objectiveEl.textContent = `Navigating to ${state.navigation.label}`;
	} else if (state.fuel <= 0.5) {
		objectiveEl.textContent =
			"Out of gas. Roll into a gas station forecourt to refill";
	} else if (state.fuel < 18) {
		objectiveEl.textContent = "Low fuel. Find a gas station";
	} else if (state.wanted > 0.05) {
		objectiveEl.textContent =
			"Evade the police or survive until your heat drops";
	} else {
		objectiveEl.textContent =
			"Cruise the city, avoid crimes, or test your luck";
	}
}

function updateNavigation(time) {
	if (!state.navigation) {
		navigationBeacon.visible = false;
		return;
	}

	const dx = state.navigation.x - car.position.x;
	const dz = state.navigation.z - car.position.z;
	const distance = Math.hypot(dx, dz);
	const direction = directionLabelToTarget(dx, dz);

	navTitleEl.textContent = `${state.navigation.label} ${Math.round(distance)}m`;
	navHintEl.textContent = `${direction} of you. Follow the beacon.`;

	navigationBeacon.visible = true;
	navigationBeacon.position.set(state.navigation.x, 0, state.navigation.z);
	beaconRing.rotation.z = time * 0.9;
	beaconRing.position.y = 0.55 + Math.sin(time * 2.5) * 0.12;
	beaconColumn.material.opacity = 0.18 + (Math.sin(time * 3) + 1) * 0.08;

	if (distance < 14) {
		navTitleEl.textContent = `${state.navigation.label} reached`;
		navHintEl.textContent =
			"Destination reached. Search another place or keep exploring.";
		if (!state.navigation.arrived) {
			state.navigation.arrived = true;
			statusPill.textContent = `${state.navigation.label} reached`;
		}
	} else {
		state.navigation.arrived = false;
	}
}

function updateFuel(delta, forwardSpeed, throttleInput, disabled) {
	const gasStations = activeGasStations(car.position.x, car.position.z);
	const nearStation = gasStations.some((station) => {
		const dx = car.position.x - station.x;
		const dz = car.position.z - station.z;
		return dx * dx + dz * dz < station.radius * station.radius;
	});
	const nearlyStopped = state.velocity.lengthSq() < 20;

	if (!disabled) {
		const passiveDrain = 0.16 * delta;
		const speedDrain = Math.abs(forwardSpeed) * 0.0065 * delta;
		const throttleDrain = Math.max(throttleInput, 0) * 0.18 * delta;
		const boostDrain = keys.boost ? 0.42 * delta : 0;
		state.fuel = Math.max(
			0,
			state.fuel - passiveDrain - speedDrain - throttleDrain - boostDrain,
		);
	}

	if (nearStation && nearlyStopped && state.fuel < 100) {
		state.fuel = Math.min(100, state.fuel + 26 * delta);
		state.refuelTime += delta;
		if (state.refuelTime > 0.25) {
			statusPill.textContent = `Refueling ${Math.round(state.fuel)}%`;
		}
	} else {
		state.refuelTime = 0;
	}

	return nearStation;
}

function animate() {
	requestAnimationFrame(animate);

	const delta = Math.min(clock.getDelta(), 0.03);
	const time = clock.elapsedTime;
	state.staticDamageCooldown = Math.max(0, state.staticDamageCooldown - delta);
	updateNavigation(time);

	if (state.paused) {
		updateHud();
		renderer.render(scene, camera);
		return;
	}

	updateChunks(car.position.x, car.position.z);
	updateDust(delta);

	const disabled = state.gameOver || state.health <= 0;
	const forwardInput = Math.max(
		keys.forward ? 1 : 0,
		touchDrive.throttle > 0.12 ? touchDrive.throttle : 0,
	);
	const backwardInput = Math.max(
		keys.backward ? 1 : 0,
		touchDrive.throttle < -0.12 ? -touchDrive.throttle : 0,
	);
	const steerInput = THREE.MathUtils.clamp(
		(keys.left ? 1 : 0) + (keys.right ? -1 : 0) - touchDrive.steer,
		-1,
		1,
	);
	const boostActive = (keys.boost || touchButtons.boost) && !disabled;
	const handbrakeActive =
		(keys.handbrake || touchButtons.handbrake) && !disabled;
	const outOfFuel = state.fuel <= 0.05;
	const acceleration = disabled || outOfFuel ? 0 : 28 * forwardInput;
	const brakeForce = 18 * backwardInput;
	const boostMultiplier = boostActive ? 1.35 : 1;
	const throttleInput = forwardInput - backwardInput;

	const steerTarget = steerInput;
	state.steer = THREE.MathUtils.lerp(state.steer, steerTarget, delta * 5.3);

	forwardVec.set(Math.sin(state.heading), 0, Math.cos(state.heading));
	rightVec.set(forwardVec.z, 0, -forwardVec.x);

	const forwardSpeed = state.velocity.dot(forwardVec);
	const lateralSpeed = state.velocity.dot(rightVec);

	state.velocity.addScaledVector(
		forwardVec,
		acceleration * boostMultiplier * delta,
	);
	state.velocity.addScaledVector(forwardVec, -brakeForce * delta);

	const gripPenalty = Math.max(0.45, state.health / 100);
	const steerStrength =
		THREE.MathUtils.clamp(
			Math.abs(forwardSpeed) / 18,
			0.25,
			handbrakeActive ? 2.5 : 2,
		) * gripPenalty;
	state.heading +=
		state.steer * steerStrength * delta * (forwardSpeed >= 0 ? 1 : -0.7);

	const grip = handbrakeActive ? 0.7 : boostActive ? 1.6 : 2.5;
	state.velocity.addScaledVector(
		rightVec,
		-lateralSpeed * Math.min(grip * delta, 1),
	);
	if (handbrakeActive) {
		state.velocity.multiplyScalar(1 - 0.62 * delta);
		state.handbrakeTime += delta;
	} else {
		state.handbrakeTime = Math.max(0, state.handbrakeTime - delta * 2);
	}
	state.velocity.multiplyScalar(1 - 1.18 * delta);

	car.position.addScaledVector(state.velocity, delta);
	car.position.y = 0;

	resolveStaticCollisions();
	updateTraffic(delta);
	updatePedestrians(delta, time);
	updatePolice(delta);
	updatePickups(delta, time);
	const nearGasStation = updateFuel(
		delta,
		forwardSpeed,
		throttleInput,
		disabled,
	);

	if (state.crimeTimer > 0) {
		state.crimeTimer -= delta;
	} else {
		state.wanted = Math.max(0, state.wanted - delta * 0.12);
	}

	if (state.comboTime > 0) {
		state.comboTime -= delta;
	} else {
		state.comboMultiplier = THREE.MathUtils.lerp(
			state.comboMultiplier,
			1,
			delta * 1.5,
		);
	}

	if (state.health <= 0 && !state.gameOver) {
		state.gameOver = true;
		state.deathMessage = state.deathMessage || "You wrecked the car";
		statusPill.textContent = state.deathMessage;
		objectiveEl.textContent = state.deathMessage;
		pursuitEl.textContent = "Lost";
		setOverlay(
			true,
			"Wrecked",
			"Car destroyed",
			"Respawn to restart the city run.",
		);
		respawnButton.classList.add("is-visible");
	}

	if (outOfFuel && !disabled) {
		statusPill.textContent = nearGasStation
			? "Stop in the forecourt to refuel"
			: "Tank empty. Find a gas station";
	} else if (state.fuel < 12 && !disabled && !nearGasStation) {
		statusPill.textContent = "Low fuel";
	}

	if (
		Math.abs(state.steer) > 0.58 &&
		Math.abs(forwardSpeed) > 14 &&
		!disabled
	) {
		state.comboTime = Math.max(state.comboTime, 3.5);
		state.comboMultiplier = Math.min(
			5,
			state.comboMultiplier + delta * (handbrakeActive ? 0.55 : 0.22),
		);
		state.score += Math.abs(lateralSpeed) * delta * 4.6 * state.comboMultiplier;
		statusPill.textContent = handbrakeActive
			? "Handbrake drift"
			: state.wanted > 0
				? "Sliding under pressure"
				: "Street drift";
	} else if (!disabled && Math.abs(forwardSpeed) > 24) {
		state.comboTime = Math.max(state.comboTime, 1.5);
		state.score += delta * 3 * state.comboMultiplier;
		if (state.wanted > 0) {
			statusPill.textContent = "Escape speed";
		}
	}

	if (
		Math.abs(forwardSpeed) > 9 &&
		dustBursts.length < 10 &&
		Math.random() < delta * 6
	) {
		createDustBurst(car.position.x, 0.2, car.position.z, 0.42, 0xb8bec9);
	}

	state.distance += previousCarPosition.distanceTo(car.position);
	previousCarPosition.copy(car.position);
	if (!disabled && state.distance > 1) {
		saveDustlineWorld();
	}

	syncCarBody(forwardSpeed, delta, throttleInput);
	car.rotation.set(state.bodyPitch, state.heading, state.bodyRoll);
	body.material.color.setHex(state.health < 25 ? 0xa32d31 : 0xf94144);

	for (const { mount, wheel, isFront } of wheels) {
		if (isFront) mount.rotation.y = -state.steer * 0.52;
		wheel.rotation.x -= forwardSpeed * delta * 1.8;
	}

	cameraTarget.copy(car.position).add(new THREE.Vector3(0, 1.8, 0));
	chaseOffset.set(0, 7.2, -14).applyAxisAngle(up, state.heading);
	cameraPosition.copy(car.position).add(chaseOffset);
	camera.position.lerp(cameraPosition, 1 - Math.pow(0.001, delta));
	camera.lookAt(cameraTarget);

	sun.position.set(
		120 + Math.sin(time * 0.05) * 20,
		145,
		40 + Math.cos(time * 0.05) * 15,
	);

	updateHud();
	renderer.render(scene, camera);
}

const clock = new THREE.Clock();
window.addEventListener("jacob-account-change", () => {
	cloudWorldLoaded = false;
	loadDustlineWorldFromAccount();
});
window.addEventListener("beforeunload", () => saveDustlineWorld({ force: true }));
resetGame({ persist: false });
loadDustlineWorld();
animate();

window.addEventListener("resize", () => {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
});
