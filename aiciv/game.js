const WORKER_URL = "https://ai-civilisation.b4rjxr9lk.workers.dev";
const USE_WORKER_AI =
	new URLSearchParams(window.location.search).get("ai") === "worker";
const GGUF_MODEL_URL =
	"https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/resolve/main/gemma-4-E2B-it-Q3_K_M.gguf";
const GGUF_MODEL_KEY = "gemma-4-E2B-it-Q3_K_M";
const MODEL_DB_NAME = "aiciv-model-cache-v1";
const MODEL_DB_VERSION = 1;
const MODEL_CHUNK_SIZE = 8 * 1024 * 1024;
const MODEL_PARALLEL_DOWNLOADS = 6;
const WLLAMA_BASE_URL = "https://cdn.jsdelivr.net/npm/@wllama/wllama@2.2.1/esm";
const canvas = document.getElementById("world");
const ctx = canvas.getContext("2d");

const ui = {
	eraName: document.getElementById("eraName"),
	year: document.getElementById("year"),
	food: document.getElementById("food"),
	metal: document.getElementById("metal"),
	culture: document.getElementById("culture"),
	science: document.getElementById("science"),
	selectedName: document.getElementById("selectedName"),
	selectedDetail: document.getElementById("selectedDetail"),
	workerStatus: document.getElementById("workerStatus"),
	turnState: document.getElementById("turnState"),
	askCouncil: document.getElementById("askCouncil"),
	decreeTitle: document.getElementById("decreeTitle"),
	decreeText: document.getElementById("decreeText"),
	focusChip: document.getElementById("focusChip"),
	policyChip: document.getElementById("policyChip"),
	directive: document.getElementById("directive"),
	rankingList: document.getElementById("rankingList"),
	countryList: document.getElementById("citizenList"),
	techList: document.getElementById("projectList"),
	decisionList: document.getElementById("factionList"),
	worldPulse: document.getElementById("worldPulse"),
	log: document.getElementById("log"),
	modelLoader: document.getElementById("modelLoader"),
	modelLoaderTitle: document.getElementById("modelLoaderTitle"),
	modelLoaderDetail: document.getElementById("modelLoaderDetail"),
	modelLoaderBar: document.getElementById("modelLoaderBar"),
	modelLoaderMeta: document.getElementById("modelLoaderMeta"),
};

const terrainColors = {
	ocean: "#244f68",
	sea: "#326b82",
	coast: "#4f8b92",
	plains: "#748957",
	forest: "#416f4b",
	desert: "#b48a50",
	mountain: "#777b7d",
	tundra: "#8ca0a2",
	ice: "#d9e7ea",
};

const techNames = [
	"Stone",
	"Bronze",
	"Iron",
	"Classical",
	"Medieval",
	"Gunpowder",
	"Industrial",
	"Electric",
	"Atomic",
	"Digital",
	"Orbital",
];
const mapModes = [
	"political",
	"terrain",
	"resources",
	"technology",
	"wealth",
	"wars",
];
const _resourceColors = {
	grain: "#e1c767",
	iron: "#b9bcc0",
	coal: "#3e4245",
	oil: "#171717",
	uranium: "#8fd46d",
	fish: "#7ec7de",
	none: "#ffffff",
};
const terrainEmoji = {
	forest: "🌲",
	mountain: "⛰️",
	desert: "🏜️",
	tundra: "❄️",
	ice: "🧊",
	coast: "🌊",
};
const resourceEmoji = {
	grain: "🌾",
	fish: "🐟",
	iron: "⛏️",
	coal: "⚫",
	oil: "🛢️",
	uranium: "☢️",
};
const cols = 86;
const rows = 48;

const countries = [
	{
		id: "aurora",
		name: "Aurora Union",
		color: "#e4bf60",
		x: 18,
		y: 17,
		ideology: "merchant republic",
	},
	{
		id: "kadesh",
		name: "Kadesh Realm",
		color: "#d66b5c",
		x: 43,
		y: 18,
		ideology: "imperial monarchy",
	},
	{
		id: "selene",
		name: "Selene League",
		color: "#72b7d6",
		x: 62,
		y: 15,
		ideology: "scholar federation",
	},
	{
		id: "verdant",
		name: "Verdant Pact",
		color: "#89bc71",
		x: 25,
		y: 31,
		ideology: "agrarian council",
	},
	{
		id: "marit",
		name: "Marit Isles",
		color: "#b7a1db",
		x: 69,
		y: 30,
		ideology: "naval confederacy",
	},
	{
		id: "umbra",
		name: "Umbra Khanate",
		color: "#c78352",
		x: 48,
		y: 32,
		ideology: "steppe compact",
	},
	{
		id: "nord",
		name: "Nordmark",
		color: "#9cc7d4",
		x: 36,
		y: 8,
		ideology: "cold-clan assembly",
	},
	{
		id: "solari",
		name: "Solari Coast",
		color: "#e59a72",
		x: 14,
		y: 36,
		ideology: "port republic",
	},
];

const state = {
	year: 1,
	era: "Ancient World",
	speed: 1,
	paused: false,
	selectedTile: null,
	selectedCountry: null,
	mapMode: "political",
	tiles: [],
	camera: { x: 0, y: 0, scale: 1 },
	events: [
		"Year 1: Countries rise from rivers, coasts, mountains, and plains.",
	],
	decisions: [],
	wars: [],
	alliances: [],
	tradeRoutes: [],
	climateStress: 0,
	aiBusy: false,
	aiQueue: [],
	localAi: null,
	localAiReady: false,
	lastTick: 0,
};

function mulberry32(seed) {
	return function random() {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const random = mulberry32(923771);

function noise(x, y) {
	const a = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
	return a - Math.floor(a);
}

function generateWorld() {
	for (let y = 0; y < rows; y += 1) {
		for (let x = 0; x < cols; x += 1) {
			const nx = x / (cols - 1);
			const ny = y / (rows - 1);
			const continent =
				blob(nx, ny, 0.25, 0.34, 0.23, 0.28) +
				blob(nx, ny, 0.52, 0.42, 0.27, 0.25) +
				blob(nx, ny, 0.76, 0.32, 0.22, 0.24) +
				blob(nx, ny, 0.28, 0.72, 0.26, 0.23) +
				blob(nx, ny, 0.66, 0.7, 0.24, 0.22);
			const jitter =
				noise(x * 0.31, y * 0.31) * 0.35 + noise(x * 0.09, y * 0.09) * 0.28;
			const elevation = continent + jitter - 0.9;
			const pole = Math.abs(ny - 0.5) * 2;
			const moisture = noise(x * 0.18 + 3, y * 0.2 + 9);
			const ridge = Math.abs(Math.sin((nx * 6.2 + ny * 3.4) * Math.PI));
			let terrain =
				elevation > -0.12
					? "plains"
					: elevation > -0.24
						? "coast"
						: elevation > -0.48
							? "sea"
							: "ocean";
			if (terrain === "plains") {
				if (pole > 0.86) terrain = "ice";
				else if (pole > 0.72) terrain = "tundra";
				else if (ridge > 0.92 && elevation > 0.12) terrain = "mountain";
				else if (moisture < 0.22 && ny > 0.2 && ny < 0.78) terrain = "desert";
				else if (moisture > 0.68) terrain = "forest";
			}
			state.tiles.push({
				x,
				y,
				terrain,
				resource: chooseResource(terrain, moisture, elevation, x, y),
				owner: null,
				city: null,
				pop: 0,
				gdp: 0,
				ore:
					terrain === "mountain" || terrain === "tundra"
						? 2 + Math.floor(noise(x, y) * 4)
						: Math.floor(noise(x + 4, y) * 2),
				food:
					terrain === "plains" || terrain === "forest" || terrain === "coast"
						? 2 + Math.floor(moisture * 4)
						: terrain === "desert"
							? 1
							: 0,
				port: terrain === "coast",
			});
		}
	}

	initCountries();
	assignStartingLand();
	countries.forEach(updateCountryResources);
	countries.forEach((country) => {
		queueCountryThink(country.id);
	});
	state.selectedCountry = countries[0];
	state.selectedTile = tileAt(countries[0].x, countries[0].y);
	centerCamera();
}

function chooseResource(terrain, moisture, elevation, x, y) {
	const roll = noise(x * 0.73 + 11, y * 0.67 + 5);
	if (terrain === "coast" && roll > 0.46) return "fish";
	if (terrain === "plains" && moisture > 0.48 && roll > 0.42) return "grain";
	if (terrain === "forest" && roll > 0.82) return "coal";
	if (terrain === "mountain" && roll > 0.42)
		return roll > 0.9 ? "uranium" : "iron";
	if (terrain === "desert" && elevation > -0.02 && roll > 0.76) return "oil";
	if (terrain === "tundra" && roll > 0.78)
		return roll > 0.92 ? "uranium" : "coal";
	return "none";
}

function blob(nx, ny, cx, cy, rx, ry) {
	const dx = (nx - cx) / rx;
	const dy = (ny - cy) / ry;
	return Math.max(0, 1 - dx * dx - dy * dy);
}

function initCountries() {
	countries.forEach((country, index) => {
		const start = nearestLand(country.x, country.y);
		country.x = start.x;
		country.y = start.y;
		country.capital = `${country.name.split(" ")[0]} City`;
		country.population = 18 + index * 3 + Math.floor(random() * 10);
		country.gdp = 30 + Math.floor(random() * 30);
		country.army = 8 + Math.floor(random() * 12);
		country.navy = countCoastsNear(start, 3) + Math.floor(random() * 5);
		country.stability = 58 + Math.floor(random() * 30);
		country.tech = {
			agriculture: 1,
			writing: 0,
			metallurgy: 0,
			navigation: country.navy > 4 ? 1 : 0,
			industry: 0,
			computing: 0,
		};
		country.resources = {};
		country.focus = "survival";
		country.policy = "settle defensible land";
		country.speech = "Our borders begin where our people can endure.";
		country.memory = [`${country.name} founds ${country.capital}.`];
		country.relations = {};
		country.nextThink = 1 + index;
		const tile = tileAt(country.x, country.y);
		tile.city = country.capital;
		tile.pop = country.population;
		tile.gdp = country.gdp;
	});
	countries.forEach((a) => {
		countries.forEach((b) => {
			if (a !== b) a.relations[b.id] = Math.floor(random() * 31) - 10;
		});
	});
}

function assignStartingLand() {
	countries.forEach((country) => {
		const start = tileAt(country.x, country.y);
		start.owner = country.id;
		const frontier = [start];
		for (let i = 0; i < 24; i += 1) {
			const next = frontier
				.flatMap(neighbors)
				.filter((tile) => isLand(tile) && !tile.owner);
			if (!next.length) break;
			const tile = next.sort((a, b) => distance(a, start) - distance(b, start))[
				Math.floor(random() * Math.min(5, next.length))
			];
			tile.owner = country.id;
			frontier.push(tile);
		}
	});
}

function tileAt(x, y) {
	return state.tiles[y * cols + x];
}

function nearestLand(x, y) {
	let best = null;
	let bestDist = Infinity;
	state.tiles.forEach((tile) => {
		if (!isLand(tile) || tile.terrain === "ice") return;
		const d = Math.hypot(tile.x - x, tile.y - y);
		if (d < bestDist) {
			best = tile;
			bestDist = d;
		}
	});
	return best;
}

function isLand(tile) {
	return tile && !["ocean", "sea"].includes(tile.terrain);
}

function neighbors(tile) {
	const out = [];
	for (let dy = -1; dy <= 1; dy += 1) {
		for (let dx = -1; dx <= 1; dx += 1) {
			if (!dx && !dy) continue;
			const nx = tile.x + dx;
			const ny = tile.y + dy;
			if (nx >= 0 && nx < cols && ny >= 0 && ny < rows)
				out.push(tileAt(nx, ny));
		}
	}
	return out;
}

function countCoastsNear(tile, radius) {
	return state.tiles.filter(
		(candidate) =>
			Math.hypot(candidate.x - tile.x, candidate.y - tile.y) <= radius &&
			candidate.terrain === "coast",
	).length;
}

function distance(a, b) {
	return Math.hypot(a.x - b.x, a.y - b.y);
}

function render() {
	ui.eraName.textContent = state.era;
	ui.year.textContent = `Year ${state.year}`;
	ui.food.textContent = countries.filter((country) => !country.fallen).length;
	ui.metal.textContent = `${Math.round(totalPopulation())}M`;
	ui.culture.textContent = state.wars.length;
	ui.science.textContent = techName(topTechLevel());
	ui.askCouncil.textContent = `Mode: ${capitalize(state.mapMode)}`;
	ui.worldPulse.textContent = `${landTiles().length} land | ${seaTiles().length} sea | ${mountainTiles().length} mountains | ${state.tradeRoutes.length} trade | ${state.alliances.length} alliances | climate ${Math.round(state.climateStress)}`;
	renderSelected();
	renderRankings();
	renderCountries();
	renderTech();
	renderDecisions();
	renderLog();
	draw();
}

function renderSelected() {
	if (state.selectedCountry) {
		const c = state.selectedCountry;
		const geo = geographySummary(c);
		const resources = resourceSummary(c.resources);
		ui.selectedName.textContent = `${c.name} | ${techName(civilLevel(c))}`;
		ui.selectedDetail.textContent = `${Math.round(c.population)}M | GDP ${Math.round(c.gdp)} | Army ${Math.round(c.army)} | Navy ${Math.round(c.navy)} | ${geo} | ${resources} | ${c.policy}`;
		return;
	}
	const tile = state.selectedTile;
	if (!tile) return;
	const owner = tile.owner ? countryById(tile.owner).name : "Unclaimed";
	ui.selectedName.textContent =
		tile.city || `${capitalize(tile.terrain)} region`;
	ui.selectedDetail.textContent = `${owner} | food ${tile.food} | ore ${tile.ore} | ${tile.resource !== "none" ? tile.resource : "no special resource"} | ${tile.port ? "port coast" : "inland"}`;
}

function renderRankings() {
	const sections = [
		[
			"Power",
			rankings(),
			(country) => Math.round(powerScore(country)),
			(country) =>
				`Tech ${techName(civilLevel(country))} | Land ${ownedTiles(country.id).length}`,
		],
		[
			"GDP",
			rankedBy((country) => country.gdp),
			(country) => Math.round(country.gdp),
			(country) =>
				`${Math.round(country.population)}M people | ${resourceSummary(country.resources)}`,
		],
		[
			"Population",
			rankedBy((country) => country.population),
			(country) => `${Math.round(country.population)}M`,
			(country) =>
				`Stability ${Math.round(country.stability)} | Food ${resourceCount(country, "grain") + resourceCount(country, "fish")}`,
		],
		[
			"Technology",
			rankedBy(civilLevel),
			(country) => techName(civilLevel(country)),
			(country) =>
				techEntries(country)
					.map(([key, val]) => `${key} ${val.toFixed(1)}`)
					.join(" | "),
		],
	];
	ui.rankingList.innerHTML = sections
		.map(
			([title, list, value, detail]) =>
				`<div class="ranking-section"><h3>${title}</h3>${list
					.slice(0, 5)
					.map((country, index) => {
						const score = powerScore(country);
						return `<article class="ranking" data-country="${country.id}">
			<strong><span>${index + 1}</span> <i style="background:${country.color}"></i>${escapeHtml(country.name)}</strong>
			<small>${escapeHtml(value(country))} | ${escapeHtml(detail(country))}</small>
			<div class="bar"><i style="width:${Math.min(100, score / 8)}%; background:${country.color}"></i></div>
		</article>`;
					})
					.join("")}</div>`,
		)
		.join("");
	ui.rankingList.querySelectorAll("[data-country]").forEach(bindCountryButton);
}

function renderCountries() {
	ui.countryList.innerHTML = countries
		.map((country) => {
			const warText = state.wars.some(
				(war) => war.a === country.id || war.b === country.id,
			)
				? "at war"
				: "peace";
			const trade = state.tradeRoutes.filter(
				(route) => route.a === country.id || route.b === country.id,
			).length;
			const allies = state.alliances.filter(
				(alliance) => alliance.a === country.id || alliance.b === country.id,
			).length;
			return `<button class="citizen ${country === state.selectedCountry ? "active" : ""}" data-country="${country.id}" type="button">
			<strong style="color:${country.color}">${escapeHtml(country.name)} <small>${escapeHtml(country.ideology)}</small></strong>
			<span>${Math.round(country.population)}M | GDP ${Math.round(country.gdp)} | ${warText} | trade ${trade} | allies ${allies}</span>
			<span>${escapeHtml(geographySummary(country))} | ${escapeHtml(resourceSummary(country.resources))}</span>
			<em>${escapeHtml(country.speech)}</em>
		</button>`;
		})
		.join("");
	ui.countryList.querySelectorAll("[data-country]").forEach(bindCountryButton);
}

function renderTech() {
	ui.techList.innerHTML = rankings()
		.map((country) => {
			const tech = techEntries(country)
				.map(([name, level]) => `${name} ${level}`)
				.join(" | ");
			return `<article class="project">
			<strong style="color:${country.color}">${escapeHtml(country.name)}: ${techName(civilLevel(country))}</strong>
			<span>${escapeHtml(tech)}</span>
			<div class="bar"><i style="width:${Math.min(100, civilLevel(country) * 10 + 8)}%; background:${country.color}"></i></div>
		</article>`;
		})
		.join("");
}

function renderDecisions() {
	ui.decisionList.innerHTML = state.decisions
		.slice(0, 12)
		.map((decision) => {
			const country = countryById(decision.country);
			return `<article class="faction">
			<strong style="color:${country?.color || "#f4efe4"}">${escapeHtml(country?.name || "Unknown")}</strong>
			<span>${escapeHtml(decision.decree)}</span>
			<span>Focus: ${escapeHtml(decision.focus)} | Policy: ${escapeHtml(decision.policy)}</span>
		</article>`;
		})
		.join("");
}

function renderLog() {
	ui.log.innerHTML = state.events
		.slice(0, 36)
		.map((entry) => `<li>${escapeHtml(entry)}</li>`)
		.join("");
}

function bindCountryButton(button) {
	button.addEventListener("click", () => {
		state.selectedCountry = countryById(button.dataset.country);
		state.selectedTile = tileAt(
			state.selectedCountry.x,
			state.selectedCountry.y,
		);
		centerCameraOn(state.selectedTile);
		renderSelected();
		draw();
	});
}

function rankings() {
	return countries
		.slice()
		.filter((c) => !c.fallen)
		.sort((a, b) => powerScore(b) - powerScore(a));
}

function rankedBy(metric) {
	return countries
		.slice()
		.filter((c) => !c.fallen)
		.sort((a, b) => metric(b) - metric(a));
}

function powerScore(country) {
	return (
		country.gdp * 1.4 +
		country.population * 0.8 +
		country.army * 2.1 +
		country.navy * 1.4 +
		ownedTiles(country.id).length * 3 +
		civilLevel(country) * 30 +
		country.stability
	);
}

function civilLevel(country) {
	const total = techEntries(country).reduce((sum, [, level]) => sum + level, 0);
	return Math.min(techNames.length - 1, Math.max(0, Math.floor(total / 2)));
}

function topTechLevel() {
	const levels = countries.filter((country) => !country.fallen).map(civilLevel);
	return levels.length ? Math.max(...levels) : 0;
}

function techName(level) {
	return techNames[level] || techNames[0];
}

function techEntries(country) {
	return Object.entries(country?.tech || {});
}

function totalPopulation() {
	return countries.reduce(
		(sum, country) => sum + Math.max(0, country.population),
		0,
	);
}

function ownedTiles(countryId) {
	return state.tiles.filter((tile) => tile.owner === countryId);
}

function updateCountryResources(country) {
	const counts = {};
	ownedTiles(country.id).forEach((tile) => {
		if (tile.resource && tile.resource !== "none")
			counts[tile.resource] = (counts[tile.resource] || 0) + 1;
	});
	country.resources = counts;
}

function resourceCount(country, resource) {
	return country.resources?.[resource] || 0;
}

function resourceSummary(resources = {}) {
	const entries = Object.entries(resources).filter(([, count]) => count > 0);
	if (!entries.length) return "few resources";
	return entries
		.slice(0, 3)
		.map(([name, count]) => `${name} ${count}`)
		.join(", ");
}

function geographySummary(country) {
	const land = ownedTiles(country.id);
	const ports = land.filter((tile) => tile.port).length;
	const mountains = land.filter((tile) => tile.terrain === "mountain").length;
	const deserts = land.filter((tile) => tile.terrain === "desert").length;
	return `${land.length} land, ${ports} ports, ${mountains} mountains, ${deserts} deserts`;
}

function landTiles() {
	return state.tiles.filter(isLand);
}

function seaTiles() {
	return state.tiles.filter(
		(tile) => tile.terrain === "ocean" || tile.terrain === "sea",
	);
}

function mountainTiles() {
	return state.tiles.filter((tile) => tile.terrain === "mountain");
}

function draw() {
	const rect = canvas.getBoundingClientRect();
	ctx.fillStyle = terrainColors.ocean;
	ctx.fillRect(0, 0, rect.width, rect.height);
	ctx.save();
	ctx.translate(state.camera.x, state.camera.y);
	ctx.scale(state.camera.scale, state.camera.scale);

	const tileW = 18;
	const tileH = 16;
	state.tiles.forEach((tile) => {
		if (tile.terrain === "ocean") return;
		const x = tile.x * tileW + tileW / 2;
		const y = tile.y * tileH + tileH / 2;
		if (tile.terrain === "sea") {
			ctx.fillStyle = tileColor(tile);
			drawLandBlob(tile, x, y, tileW, tileH);
			return;
		}
		ctx.fillStyle = tileColor(tile);
		drawLandBlob(tile, x, y, tileW, tileH);
		if (state.mapMode === "political" && tile.owner) {
			const country = countryById(tile.owner);
			ctx.fillStyle = hexToRgba(country.color, 0.36);
			drawLandBlob(tile, x, y, tileW * 0.92, tileH * 0.92);
		}
		drawMapEmoji(tile, x, y);
	});

	drawBorders(tileW, tileH);
	drawRoutes(tileW, tileH);
	countries.forEach((country) => {
		drawCapital(country, tileW, tileH);
	});
	state.wars.forEach((war) => {
		drawWarLine(war, tileW, tileH);
	});
	if (state.selectedTile) drawSelection(state.selectedTile, tileW, tileH);
	ctx.restore();
}

function tileColor(tile) {
	if (state.mapMode === "terrain" || !tile.owner)
		return terrainColors[tile.terrain];
	const country = countryById(tile.owner);
	if (!country) return terrainColors[tile.terrain];
	if (state.mapMode === "technology")
		return heatColor(
			civilLevel(country),
			0,
			techNames.length - 1,
			"#2f4f64",
			"#f0d998",
		);
	if (state.mapMode === "wealth")
		return heatColor(
			country.gdp / Math.max(1, ownedTiles(country.id).length),
			0,
			18,
			"#334b42",
			"#e59a72",
		);
	if (state.mapMode === "wars") {
		const atWar = state.wars.some(
			(war) => war.a === country.id || war.b === country.id,
		);
		return atWar ? "#b9423b" : hexToRgba(country.color, 0.55);
	}
	return terrainColors[tile.terrain];
}

function drawLandBlob(tile, x, y, tileW, tileH) {
	if (tile.terrain === "sea") {
		ctx.globalAlpha = 0.34;
		ctx.beginPath();
		ctx.ellipse(x, y, tileW * 0.75, tileH * 0.72, 0, 0, Math.PI * 2);
		ctx.fill();
		ctx.globalAlpha = 1;
		return;
	}
	const wobble = noise(tile.x * 0.91, tile.y * 0.83) * 0.2;
	ctx.beginPath();
	ctx.ellipse(
		x,
		y,
		tileW * (0.72 + wobble),
		tileH * (0.72 - wobble * 0.4),
		noise(tile.x, tile.y) * 0.9,
		0,
		Math.PI * 2,
	);
	ctx.fill();
}

function drawMapEmoji(tile, x, y) {
	const n = noise(tile.x * 1.7 + 40, tile.y * 1.9 + 12);
	const owned = Boolean(tile.owner);
	let symbol = "";
	let size = 12;
	if (state.mapMode === "resources" && tile.resource !== "none") {
		symbol = resourceEmoji[tile.resource] || "";
		size = 13;
	} else if (
		(tile.resource === "grain" || tile.food >= 5) &&
		owned &&
		n > 0.91
	) {
		symbol = "🌾";
		size = 11;
	} else if (tile.port && owned && n > 0.86) {
		symbol = "⚓";
		size = 11;
	} else if (
		terrainEmoji[tile.terrain] &&
		n > terrainEmojiThreshold(tile.terrain)
	) {
		symbol = terrainEmoji[tile.terrain];
		size = tile.terrain === "mountain" ? 13 : 11;
	} else if (owned && isLand(tile) && n > 0.925) {
		symbol = "👥";
		size = 10;
	}
	if (!symbol) return;
	ctx.save();
	ctx.font = `${size}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", system-ui`;
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
	ctx.shadowBlur = 2;
	ctx.fillText(symbol, x, y + 1);
	ctx.restore();
}

function terrainEmojiThreshold(terrain) {
	if (terrain === "mountain") return 0.56;
	if (terrain === "forest") return 0.86;
	if (terrain === "desert") return 0.88;
	if (terrain === "tundra" || terrain === "ice") return 0.9;
	if (terrain === "coast" || terrain === "ocean" || terrain === "sea")
		return 0.96;
	return 1;
}

function heatColor(value, min, max, low, high) {
	const t = clamp((value - min) / Math.max(0.001, max - min), 0, 1);
	const a = hexToRgb(low);
	const b = hexToRgb(high);
	const r = Math.round(a.r + (b.r - a.r) * t);
	const g = Math.round(a.g + (b.g - a.g) * t);
	const blue = Math.round(a.b + (b.b - a.b) * t);
	return `rgb(${r}, ${g}, ${blue})`;
}

function drawBorders(tileW, tileH) {
	ctx.strokeStyle = "rgba(12, 16, 18, 0.58)";
	ctx.lineWidth = 1.4;
	state.tiles.forEach((tile) => {
		if (!tile.owner || tile.terrain === "ocean" || tile.terrain === "sea")
			return;
		const x = tile.x * tileW + tileW / 2;
		const y = tile.y * tileH + tileH / 2;
		for (let d = 0; d < 4; d += 1) {
			const dx = d === 0 ? 1 : d === 1 ? 0 : d === 2 ? 1 : 1;
			const dy = d === 0 ? 0 : d === 1 ? 1 : d === 2 ? 1 : -1;
			const nx = tile.x + dx;
			const ny = tile.y + dy;
			if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
			const near = tileAt(nx, ny);
			if (near.owner && near.owner !== tile.owner) {
				const nxp = nx * tileW + tileW / 2;
				const nyp = ny * tileH + tileH / 2;
				ctx.beginPath();
				ctx.moveTo((x + nxp) / 2 - 4, (y + nyp) / 2 - 4);
				ctx.lineTo((x + nxp) / 2 + 4, (y + nyp) / 2 + 4);
				ctx.stroke();
			}
		}
	});
}

function drawCapital(country, tileW, tileH) {
	const x = country.x * tileW + tileW / 2;
	const y = country.y * tileH + tileH / 2;
	ctx.save();
	ctx.fillStyle = hexToRgba(country.color, 0.9);
	ctx.strokeStyle = "#f4efe4";
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.arc(x, y, 9 + Math.min(7, country.population / 35), 0, Math.PI * 2);
	ctx.fill();
	ctx.stroke();
	ctx.font =
		'15px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", system-ui';
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.fillText(
		country.navy > 8 ? "⚓" : country.army > 45 ? "🛡️" : "🏛️",
		x,
		y + 1,
	);
	ctx.font =
		'10px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", system-ui';
	ctx.fillText("👥", x + 17, y + 10);
	ctx.fillStyle = "rgba(0, 0, 0, 0.68)";
	ctx.fillRect(x - 38, y - 27, 76, 16);
	ctx.fillStyle = "#f4efe4";
	ctx.font = "10px system-ui";
	ctx.textAlign = "center";
	ctx.fillText(country.name.split(" ")[0], x, y - 15);
	ctx.restore();
}

function drawWarLine(war, tileW, tileH) {
	const a = countryById(war.a);
	const b = countryById(war.b);
	if (!a || !b) return;
	ctx.strokeStyle = "rgba(224, 70, 70, 0.82)";
	ctx.lineWidth = 3;
	ctx.setLineDash([8, 6]);
	ctx.beginPath();
	ctx.moveTo(a.x * tileW + tileW / 2, a.y * tileH + tileH / 2);
	ctx.lineTo(b.x * tileW + tileW / 2, b.y * tileH + tileH / 2);
	ctx.stroke();
	ctx.setLineDash([]);
	drawLineEmoji(
		"⚔️",
		((a.x + b.x) * tileW) / 2 + tileW / 2,
		((a.y + b.y) * tileH) / 2 + tileH / 2,
		16,
	);
}

function drawRoutes(tileW, tileH) {
	state.tradeRoutes.forEach((route) => {
		const a = countryById(route.a);
		const b = countryById(route.b);
		if (!a || !b) return;
		ctx.strokeStyle = "rgba(240, 217, 152, 0.54)";
		ctx.lineWidth = 1.5 + Math.min(3, route.volume * 0.35);
		ctx.setLineDash([4, 5]);
		ctx.beginPath();
		ctx.moveTo(a.x * tileW + tileW / 2, a.y * tileH + tileH / 2);
		ctx.lineTo(b.x * tileW + tileW / 2, b.y * tileH + tileH / 2);
		ctx.stroke();
		ctx.setLineDash([]);
		drawLineEmoji(
			"🚢",
			((a.x + b.x) * tileW) / 2 + tileW / 2,
			((a.y + b.y) * tileH) / 2 + tileH / 2,
			12,
		);
	});
	state.alliances.forEach((alliance) => {
		const a = countryById(alliance.a);
		const b = countryById(alliance.b);
		if (!a || !b) return;
		ctx.strokeStyle = "rgba(116, 209, 133, 0.68)";
		ctx.lineWidth = 2.2;
		ctx.beginPath();
		ctx.moveTo(a.x * tileW + tileW / 2, a.y * tileH + tileH / 2);
		ctx.lineTo(b.x * tileW + tileW / 2, b.y * tileH + tileH / 2);
		ctx.stroke();
		drawLineEmoji(
			"🤝",
			((a.x + b.x) * tileW) / 2 + tileW / 2,
			((a.y + b.y) * tileH) / 2 + tileH / 2,
			12,
		);
	});
}

function drawLineEmoji(symbol, x, y, size) {
	ctx.save();
	ctx.font = `${size}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", system-ui`;
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
	ctx.shadowBlur = 3;
	ctx.fillText(symbol, x, y);
	ctx.restore();
}

function drawSelection(tile, tileW, tileH) {
	ctx.strokeStyle = "#fff3b0";
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.ellipse(
		tile.x * tileW + tileW / 2,
		tile.y * tileH + tileH / 2,
		tileW * 0.7,
		tileH * 0.7,
		0,
		0,
		Math.PI * 2,
	);
	ctx.stroke();
}

function simulateYear() {
	if (state.paused) return;
	state.year += 1;
	countries.forEach((country) => {
		if (country.fallen) return;
		const land = ownedTiles(country.id);
		updateCountryResources(country);
		const food = land.reduce((sum, tile) => sum + tile.food, 0);
		const ore = land.reduce((sum, tile) => sum + tile.ore, 0);
		const ports = land.filter((tile) => tile.port).length;
		const mountainShield = land.filter(
			(tile) => tile.terrain === "mountain",
		).length;
		const grain = resourceCount(country, "grain");
		const fish = resourceCount(country, "fish");
		const iron = resourceCount(country, "iron");
		const coal = resourceCount(country, "coal");
		const oil = resourceCount(country, "oil");
		const uranium = resourceCount(country, "uranium");
		country.population *=
			1 +
			Math.min(
				0.035,
				0.006 +
					(food + grain * 4 + fish * 2) /
						Math.max(1200, country.population * 780),
			);
		country.gdp +=
			food * 0.06 +
			ore * 0.18 +
			ports * (0.4 + country.tech.navigation * 0.18) +
			country.tech.industry * (0.8 + coal * 0.08 + oil * 0.16);
		country.army +=
			ore * 0.025 +
			iron * 0.09 +
			oil * 0.05 +
			country.tech.metallurgy * 0.28 +
			country.tech.industry * 0.18;
		country.navy += ports * 0.035 + oil * 0.03 + country.tech.navigation * 0.08;
		if (uranium && civilLevel(country) >= 7)
			improveTech(country, "computing", 0.04);
		country.stability +=
			mountainShield * 0.01 +
			country.tech.writing * 0.05 -
			state.climateStress * 0.003 -
			state.wars.filter((war) => war.a === country.id || war.b === country.id)
				.length *
				0.22;
		country.stability = clamp(country.stability, 5, 100);
		applyFocus(country);
		if (state.year >= country.nextThink) queueCountryThink(country.id);
	});
	simulateExpansion();
	simulateDiplomacy();
	simulateClimate();
	simulateWars();
	advanceEra();
	processAiQueue();
	if (state.year % 5 === 0)
		addLog(
			`Year ${state.year}: ${rankings()[0].name} leads the world rankings.`,
		);
}

function applyFocus(country) {
	const focus = String(country.focus).toLowerCase();
	if (
		focus.includes("science") ||
		focus.includes("research") ||
		focus.includes("tech")
	)
		improveTech(country, "writing", 0.18);
	if (
		focus.includes("navy") ||
		focus.includes("trade") ||
		focus.includes("sea")
	)
		improveTech(country, "navigation", 0.2);
	if (focus.includes("industry") || focus.includes("economy"))
		improveTech(country, "industry", 0.14);
	if (focus.includes("military") || focus.includes("war"))
		improveTech(country, "metallurgy", 0.16);
	if (focus.includes("growth") || focus.includes("food"))
		improveTech(country, "agriculture", 0.16);
}

function improveTech(country, field, amount) {
	country.tech[field] = Math.min(10, country.tech[field] + amount);
}

function simulateExpansion() {
	countries.forEach((country) => {
		if (country.fallen) return;
		const chance =
			0.14 + country.population / 900 + civilLevel(country) * 0.012;
		if (random() > chance) return;
		const border = ownedTiles(country.id)
			.flatMap(neighbors)
			.filter((tile) => isLand(tile) && !tile.owner && tile.terrain !== "ice");
		if (!border.length) return;
		const target = border.sort(
			(a, b) => tileValue(b, country) - tileValue(a, country),
		)[0];
		target.owner = country.id;
		addLog(
			`${country.name} settles ${target.terrain} land near ${target.x}, ${target.y}.`,
		);
	});
}

function tileValue(tile, country) {
	const resourceBonus =
		tile.resource === "none"
			? 0
			: tile.resource === "uranium"
				? 12
				: tile.resource === "oil"
					? 10
					: tile.resource === "iron" || tile.resource === "coal"
						? 8
						: 5;
	return (
		tile.food * 3 +
		tile.ore * 4 +
		resourceBonus +
		(tile.port ? 6 + country.tech.navigation : 0) -
		(tile.terrain === "mountain" ? 4 : 0) -
		(tile.terrain === "desert" ? 3 : 0)
	);
}

function simulateDiplomacy() {
	state.tradeRoutes = state.tradeRoutes.filter(
		(route) => countryById(route.a) && countryById(route.b),
	);
	state.alliances = state.alliances.filter(
		(alliance) => countryById(alliance.a) && countryById(alliance.b),
	);
	countries.forEach((a) => {
		countries.forEach((b) => {
			if (a === b || a.id > b.id || a.fallen || b.fallen) return;
			const relation = (a.relations[b.id] || 0) + (b.relations[a.id] || 0);
			const routeExists = state.tradeRoutes.some((route) =>
				samePair(route, a.id, b.id),
			);
			const allianceExists = state.alliances.some((alliance) =>
				samePair(alliance, a.id, b.id),
			);
			const ports =
				ownedTiles(a.id).some((tile) => tile.port) &&
				ownedTiles(b.id).some((tile) => tile.port);
			const landConnected = shareBorder(a.id, b.id);
			if (
				!routeExists &&
				(ports || landConnected) &&
				relation > 10 &&
				random() < 0.025
			) {
				state.tradeRoutes.push({
					a: a.id,
					b: b.id,
					volume: 1 + Math.floor(random() * 5),
				});
				addLog(`${a.name} and ${b.name} open a trade route.`);
			}
			if (!allianceExists && relation > 55 && random() < 0.01) {
				state.alliances.push({ a: a.id, b: b.id, year: state.year });
				addLog(`${a.name} and ${b.name} sign an alliance.`);
			}
			if (routeExists) {
				a.gdp += 0.16;
				b.gdp += 0.16;
				a.relations[b.id] += 0.03;
				b.relations[a.id] += 0.03;
			}
		});
	});
}

function simulateClimate() {
	const industrial = countries.reduce(
		(sum, country) =>
			sum +
			country.tech.industry +
			resourceCount(country, "coal") * 0.05 +
			resourceCount(country, "oil") * 0.08,
		0,
	);
	state.climateStress = clamp(
		state.climateStress + industrial * 0.002 - 0.01,
		0,
		100,
	);
	if (state.climateStress > 35 && state.year % 9 === 0) {
		const coastal = state.tiles.filter((tile) => tile.owner && tile.port);
		const hit = coastal[Math.floor(random() * coastal.length)];
		if (hit) {
			const country = countryById(hit.owner);
			country.gdp *= 0.985;
			country.stability -= 1.2;
			addLog(
				`Storm surges damage ${country.name}'s coast as climate stress rises.`,
			);
		}
	}
}

function samePair(item, a, b) {
	return (item.a === a && item.b === b) || (item.a === b && item.b === a);
}

function simulateWars() {
	state.wars.slice().forEach((war) => {
		const a = countryById(war.a);
		const b = countryById(war.b);
		if (!a || !b) return;
		war.years += 1;
		const aPower = a.army + a.navy * 0.35 + civilLevel(a) * 4 + random() * 10;
		const bPower = b.army + b.navy * 0.35 + civilLevel(b) * 4 + random() * 10;
		const winner = aPower > bPower ? a : b;
		const loser = winner === a ? b : a;
		captureBorder(winner, loser);
		winner.army *= 0.985;
		loser.army *= 0.96;
		winner.gdp *= 0.995;
		loser.gdp *= 0.985;
		if (war.years > 3 && random() < 0.34) {
			endWar(war, `${winner.name} forces a treaty with ${loser.name}.`);
		}
	});

	countries.forEach((a) => {
		countries.forEach((b) => {
			if (a === b || a.fallen || b.fallen || a.id > b.id) return;
			if (
				state.wars.some(
					(war) =>
						(war.a === a.id && war.b === b.id) ||
						(war.a === b.id && war.b === a.id),
				)
			)
				return;
			if (state.alliances.some((alliance) => samePair(alliance, a.id, b.id)))
				return;
			if (!shareBorder(a.id, b.id)) return;
			const relation = a.relations[b.id] + b.relations[a.id];
			const pressure = (a.army + b.army) / 240 + (relation < -25 ? 0.18 : 0);
			if (random() < pressure * 0.015) startWar(a, b);
		});
	});
}

function captureBorder(winner, loser) {
	const candidates = ownedTiles(loser.id).filter((tile) =>
		neighbors(tile).some((near) => near.owner === winner.id),
	);
	if (!candidates.length) return;
	const target = candidates.sort(
		(a, b) => tileValue(b, winner) - tileValue(a, winner),
	)[0];
	target.owner = winner.id;
	if (target.city) {
		winner.memory.push(`Captured ${target.city} from ${loser.name}.`);
		loser.memory.push(`Lost ${target.city} to ${winner.name}.`);
	}
}

function shareBorder(a, b) {
	return ownedTiles(a).some((tile) =>
		neighbors(tile).some((near) => near.owner === b),
	);
}

function startWar(a, b) {
	state.wars.push({ a: a.id, b: b.id, years: 0 });
	state.tradeRoutes = state.tradeRoutes.filter(
		(route) => !samePair(route, a.id, b.id),
	);
	state.alliances = state.alliances.filter(
		(alliance) => !samePair(alliance, a.id, b.id),
	);
	a.relations[b.id] -= 35;
	b.relations[a.id] -= 35;
	addLog(`${a.name} and ${b.name} go to war over borders and security.`);
}

function endWar(war, text) {
	state.wars = state.wars.filter((item) => item !== war);
	addLog(text);
}

function advanceEra() {
	const level = topTechLevel();
	if (level >= 9) state.era = "Digital Earth";
	else if (level >= 7) state.era = "Industrial Earth";
	else if (level >= 5) state.era = "Gunpowder World";
	else if (level >= 3) state.era = "Classical World";
	else state.era = "Ancient World";
}

function queueCountryThink(countryId) {
	if (state.aiQueue.includes(countryId)) return;
	state.aiQueue.push(countryId);
	const country = countryById(countryId);
	country.nextThink = state.year + 6 + Math.floor(random() * 8);
}

function processAiQueue() {
	if (state.aiBusy || !state.aiQueue.length) return;
	const countryId = state.aiQueue.shift();
	requestCountryDecision(countryId);
}

async function requestCountryDecision(countryId) {
	const country = countryById(countryId);
	if (!country || country.fallen) return;
	state.aiBusy = true;
	ui.turnState.textContent = `${country.name} deciding`;
	render();
	if (state.localAiReady) {
		try {
			const decision = await requestLocalGgufDecision(country);
			applyDecision(country, decision);
			ui.workerStatus.textContent = "GGUF local AI";
			ui.workerStatus.className = "online";
		} catch (error) {
			console.warn(
				"Local GGUF decision failed; using deterministic fallback.",
				error,
			);
			applyDecision(country, localDecision(country));
			ui.workerStatus.textContent = "GGUF fallback";
			ui.workerStatus.className = "error";
		}
		state.aiBusy = false;
		ui.turnState.textContent = "World running";
		render();
		return;
	}
	if (!USE_WORKER_AI) {
		applyDecision(country, localDecision(country));
		ui.workerStatus.textContent = "Local simulation";
		ui.workerStatus.className = "";
		state.aiBusy = false;
		ui.turnState.textContent = "World running";
		render();
		return;
	}
	try {
		const response = await fetch(`${WORKER_URL}/turn`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				faction: country,
				directive: ui.directive.value,
				game: worldSnapshot(country),
			}),
		});
		if (!response.ok) throw new Error(`Worker ${response.status}`);
		const decision = await response.json();
		applyDecision(country, decision);
		ui.workerStatus.textContent =
			decision.ai === false ? "Fallback policy" : "Worker online";
		ui.workerStatus.className = decision.ai === false ? "" : "online";
	} catch (error) {
		console.warn(error);
		applyDecision(country, fallbackDecision(country));
		ui.workerStatus.textContent = "Worker fallback";
		ui.workerStatus.className = "error";
	} finally {
		state.aiBusy = false;
		ui.turnState.textContent = "World running";
		render();
	}
}

function worldSnapshot(country) {
	return {
		year: state.year,
		era: state.era,
		events: state.events.slice(0, 10),
		wars: state.wars,
		alliances: state.alliances,
		tradeRoutes: state.tradeRoutes,
		country: publicCountry(country),
		neighbors: countries
			.filter((other) => other !== country && shareBorder(country.id, other.id))
			.map(publicCountry),
		rankings: rankings().map((item, index) => ({
			rank: index + 1,
			...publicCountry(item),
			score: Math.round(powerScore(item)),
		})),
		world: {
			land: landTiles().length,
			seas: seaTiles().length,
			mountains: mountainTiles().length,
			topTech: techNames[topTechLevel()],
			climateStress: Math.round(state.climateStress),
		},
	};
}

function publicCountry(country) {
	return {
		id: country.id,
		name: country.name,
		population: Math.round(country.population),
		gdp: Math.round(country.gdp),
		army: Math.round(country.army),
		navy: Math.round(country.navy),
		stability: Math.round(country.stability),
		land: ownedTiles(country.id).length,
		ports: ownedTiles(country.id).filter((tile) => tile.port).length,
		geography: geographySummary(country),
		resources: country.resources,
		tradeRoutes: state.tradeRoutes.filter(
			(route) => route.a === country.id || route.b === country.id,
		).length,
		alliances: state.alliances.filter(
			(alliance) => alliance.a === country.id || alliance.b === country.id,
		).length,
		tech: country.tech,
		focus: country.focus,
		policy: country.policy,
		memory: country.memory.slice(-5),
	};
}

async function requestLocalGgufDecision(country) {
	const prompt = buildGgufDecisionPrompt(country);
	const response = await state.localAi.createChatCompletion({
		messages: [
			{
				role: "system",
				content:
					"You run one autonomous country in a compact strategy simulation. Return only valid minified JSON. No markdown.",
			},
			{ role: "user", content: prompt },
		],
		temperature: 0.55,
		top_p: 0.88,
		max_tokens: 220,
	});
	const text =
		response?.choices?.[0]?.message?.content ||
		response?.choices?.[0]?.text ||
		"";
	const parsed = parseDecisionJson(text);
	return normalizeAiDecision(parsed, country, "local gguf");
}

function buildGgufDecisionPrompt(country) {
	const snapshot = worldSnapshot(country);
	return [
		ui.directive.value,
		"Choose the next national policy from the current world state.",
		"Return JSON with these string keys only: decree, reason, focus, policy, speech, build, target.",
		"Keep decree and speech short. Use build to name one practical action such as army, navy, farms, industry, research, treaty, roads, or ports.",
		JSON.stringify(snapshot),
	].join("\n");
}

function parseDecisionJson(text) {
	const trimmed = String(text || "").trim();
	try {
		return JSON.parse(trimmed);
	} catch (error) {
		const match = trimmed.match(/\{[\s\S]*\}/);
		if (!match) throw error;
		return JSON.parse(match[0]);
	}
}

function normalizeAiDecision(value, country, note) {
	if (!value || typeof value !== "object")
		throw new Error("AI returned no decision object.");
	const fallback = localDecision(country);
	return {
		ai: true,
		decree: clean(value.decree, fallback.decree),
		reason: clean(value.reason, fallback.reason),
		focus: clean(value.focus, fallback.focus),
		policy: clean(value.policy, fallback.policy),
		speech: clean(value.speech, fallback.speech),
		build: clean(value.build, fallback.build),
		target: clean(value.target, fallback.target),
		note,
	};
}

function applyDecision(country, decision) {
	const decree = clean(
		decision.decree,
		"Preserve the state and study the map.",
	);
	const focus = clean(decision.focus, "balanced").toLowerCase();
	const policy = clean(decision.policy, "practical statecraft").toLowerCase();
	country.focus = focus;
	country.policy = policy;
	country.speech = clean(decision.speech, decree);
	country.memory.push(`${state.year}: ${decree}`);
	state.decisions.unshift({
		country: country.id,
		decree,
		focus,
		policy,
		year: state.year,
	});
	state.decisions = state.decisions.slice(0, 24);
	ui.decreeTitle.textContent = `${country.name}: ${decree}`;
	ui.decreeText.textContent = clean(
		decision.reason,
		"The government adjusts to geography, rivals, technology, and survival.",
	);
	ui.focusChip.textContent = `Focus: ${focus}`;
	ui.policyChip.textContent = `Policy: ${policy}`;
	applyDecisionEffect(country, decision);
	addLog(`${country.name} chooses: ${decree}`);
}

function applyDecisionEffect(country, decision) {
	const action =
		`${decision.build || ""} ${decision.target || ""} ${country.focus}`.toLowerCase();
	if (
		action.includes("navy") ||
		action.includes("sea") ||
		action.includes("trade")
	) {
		country.navy += 2.5;
		improveTech(country, "navigation", 0.45);
	}
	if (
		action.includes("army") ||
		action.includes("war") ||
		action.includes("military")
	) {
		country.army += 3.5;
		improveTech(country, "metallurgy", 0.3);
	}
	if (
		action.includes("science") ||
		action.includes("research") ||
		action.includes("writing") ||
		action.includes("tech")
	) {
		improveTech(country, "writing", 0.45);
		improveTech(country, "computing", civilLevel(country) > 6 ? 0.2 : 0);
	}
	if (
		action.includes("industry") ||
		action.includes("economy") ||
		action.includes("infrastructure")
	) {
		country.gdp += 8;
		improveTech(country, "industry", 0.35);
	}
	if (
		action.includes("farm") ||
		action.includes("growth") ||
		action.includes("food")
	) {
		country.population += 2;
		improveTech(country, "agriculture", 0.35);
	}
	if (action.includes("diplomacy") || action.includes("treaty")) {
		Object.keys(country.relations).forEach((id) => {
			country.relations[id] += 4;
		});
		country.stability += 2;
	}
}

function fallbackDecision(country) {
	const ports = ownedTiles(country.id).filter((tile) => tile.port).length;
	const focus = ports > 3 ? "naval trade" : "economic growth";
	return {
		ai: false,
		decree:
			ports > 3
				? "Build ships and control sea lanes."
				: "Strengthen farms, roads, and defenses.",
		reason: "The country follows geography and internal pressure.",
		focus,
		policy: ports > 3 ? "maritime expansion" : "balanced development",
		speech: country.speech,
		build: ports > 3 ? "navy" : "infrastructure",
		target: ports > 3 ? "seas" : "land",
	};
}

function localDecision(country) {
	const land = ownedTiles(country.id);
	const ports = land.filter((tile) => tile.port).length;
	const mountains = land.filter((tile) => tile.terrain === "mountain").length;
	const deserts = land.filter((tile) => tile.terrain === "desert").length;
	const food = land.reduce((sum, tile) => sum + tile.food, 0);
	const ore = land.reduce((sum, tile) => sum + tile.ore, 0);
	const atWar = state.wars.some(
		(war) => war.a === country.id || war.b === country.id,
	);
	const trade = state.tradeRoutes.filter(
		(route) => route.a === country.id || route.b === country.id,
	).length;
	const allies = state.alliances.filter(
		(alliance) => alliance.a === country.id || alliance.b === country.id,
	).length;
	const neighbors = countries.filter(
		(other) =>
			other !== country && !other.fallen && shareBorder(country.id, other.id),
	);
	const hostileNeighbor = neighbors
		.slice()
		.sort(
			(a, b) => (country.relations[a.id] || 0) - (country.relations[b.id] || 0),
		)[0];
	const pressure = country.population / Math.max(1, food * 2.6);
	const rank = rankings().findIndex((item) => item.id === country.id) + 1;
	const weakArmy = hostileNeighbor && country.army < hostileNeighbor.army * 0.8;
	const strongPorts = ports >= 4;
	const poorStability = country.stability < 42;
	const scienceLag =
		rank > Math.ceil(countries.length / 2) &&
		civilLevel(country) < topTechLevel();
	const next = [
		{
			when: atWar || weakArmy,
			decree: atWar
				? "Hold borders and modernize command."
				: "Raise defenses before rivals test us.",
			reason: atWar
				? "War rewards prepared armies, secure roads, and clear command."
				: `${hostileNeighbor?.name || "A neighbor"} has enough force to pressure the border.`,
			focus: "military",
			policy: "border security",
			build: "army",
			target: hostileNeighbor?.name || "nearest rival",
		},
		{
			when: pressure > 1.1 || food < country.population * 0.45,
			decree: "Expand farms before hunger spreads.",
			reason:
				"Population growth is outrunning food supply, so stability depends on grain and fish.",
			focus: "growth",
			policy: "food security",
			build: "farms",
			target: "high food land",
		},
		{
			when: strongPorts && trade < 2,
			decree: "Turn ports into trade power.",
			reason: "Coasts and harbors can grow wealth faster than inland taxes.",
			focus: "trade",
			policy: "maritime commerce",
			build: "ports",
			target: "sea lanes",
		},
		{
			when: ore > food && country.gdp < country.population * 1.8,
			decree: "Forge industry from the hills.",
			reason:
				"Ore-rich territory can become factories, roads, and stronger public revenue.",
			focus: "industry",
			policy: "industrial works",
			build: "industry",
			target: "ore districts",
		},
		{
			when: scienceLag,
			decree: "Fund schools and technical maps.",
			reason:
				"The country is falling behind the leading powers and needs better knowledge.",
			focus: "science",
			policy: "public research",
			build: "research",
			target: "scholars",
		},
		{
			when: poorStability,
			decree: "Cool unrest with civic repairs.",
			reason:
				"Low stability can weaken armies, markets, and diplomacy at once.",
			focus: "balanced",
			policy: "civic recovery",
			build: "roads",
			target: "restless provinces",
		},
		{
			when: allies < 1 && neighbors.length > 1,
			decree: "Seek treaties before borders harden.",
			reason:
				"Nearby states can become trade partners instead of future fronts.",
			focus: "diplomacy",
			policy: "neighbor treaties",
			build: "treaty",
			target: neighbors[0]?.name || "neighbors",
		},
		{
			when: true,
			decree:
				deserts > mountains
					? "Settle water routes and resilient towns."
					: "Balance growth, roads, and learning.",
			reason:
				"Geography, population, and rivals call for steady state-building.",
			focus: strongPorts ? "navy" : "balanced",
			policy: strongPorts ? "coastal development" : "strategic development",
			build: strongPorts ? "navy" : "research",
			target: strongPorts ? "coasts" : "national capacity",
		},
	].find((item) => item.when);
	return {
		ai: false,
		decree: next.decree,
		reason: next.reason,
		focus: next.focus,
		policy: next.policy,
		speech: country.speech || "The country adapts to the map.",
		build: next.build,
		target: next.target,
		note: "local deterministic policy engine",
	};
}

function addLog(text) {
	state.events.unshift(`Year ${state.year}: ${text}`);
	state.events = state.events.slice(0, 60);
}

function countryById(id) {
	return countries.find((country) => country.id === id);
}

function clean(value, fallback) {
	return String(value || fallback)
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 180);
}

function escapeHtml(value) {
	return String(value).replace(
		/[&<>"']/g,
		(char) =>
			({
				"&": "&amp;",
				"<": "&lt;",
				">": "&gt;",
				'"': "&quot;",
				"'": "&#39;",
			})[char],
	);
}

function capitalize(value) {
	return value.charAt(0).toUpperCase() + value.slice(1);
}

function clamp(value, min, max) {
	return Math.max(min, Math.min(max, value));
}

function hexToRgba(hex, alpha) {
	const value = hex.replace("#", "");
	const r = parseInt(value.slice(0, 2), 16);
	const g = parseInt(value.slice(2, 4), 16);
	const b = parseInt(value.slice(4, 6), 16);
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function hexToRgb(hex) {
	const value = hex.replace("#", "");
	return {
		r: parseInt(value.slice(0, 2), 16),
		g: parseInt(value.slice(2, 4), 16),
		b: parseInt(value.slice(4, 6), 16),
	};
}

function resizeCanvas() {
	const dpr = window.devicePixelRatio || 1;
	const rect = canvas.getBoundingClientRect();
	canvas.width = Math.floor(rect.width * dpr);
	canvas.height = Math.floor(rect.height * dpr);
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	draw();
}

function centerCamera() {
	const rect = canvas.getBoundingClientRect();
	state.camera.x = Math.max(12, (rect.width - cols * 18) / 2);
	state.camera.y = Math.max(88, (rect.height - rows * 16) / 2);
}

function centerCameraOn(tile) {
	const rect = canvas.getBoundingClientRect();
	state.camera.x = rect.width / 2 - tile.x * 18 * state.camera.scale;
	state.camera.y = rect.height / 2 - tile.y * 16 * state.camera.scale;
}

function worldClick(event) {
	const rect = canvas.getBoundingClientRect();
	const x = Math.floor(
		(event.clientX - rect.left - state.camera.x) / (18 * state.camera.scale),
	);
	const y = Math.floor(
		(event.clientY - rect.top - state.camera.y) / (16 * state.camera.scale),
	);
	if (x < 0 || x >= cols || y < 0 || y >= rows) return;
	const tile = tileAt(x, y);
	state.selectedTile = tile;
	state.selectedCountry = tile.owner ? countryById(tile.owner) : null;
	renderSelected();
	draw();
}

function bindDrag() {
	let dragging = false;
	let last = null;
	canvas.addEventListener("pointerdown", (event) => {
		dragging = true;
		last = { x: event.clientX, y: event.clientY };
		canvas.setPointerCapture(event.pointerId);
	});
	canvas.addEventListener("pointermove", (event) => {
		if (!dragging || !last) return;
		const dx = event.clientX - last.x;
		const dy = event.clientY - last.y;
		if (Math.abs(dx) + Math.abs(dy) > 1) {
			state.camera.x += dx;
			state.camera.y += dy;
			last = { x: event.clientX, y: event.clientY };
			draw();
		}
	});
	canvas.addEventListener("pointerup", (event) => {
		dragging = false;
		last = null;
		canvas.releasePointerCapture(event.pointerId);
	});
	canvas.addEventListener(
		"wheel",
		(event) => {
			event.preventDefault();
			const old = state.camera.scale;
			state.camera.scale = clamp(
				state.camera.scale + (event.deltaY > 0 ? -0.08 : 0.08),
				0.7,
				2.2,
			);
			const rect = canvas.getBoundingClientRect();
			const mx = event.clientX - rect.left;
			const my = event.clientY - rect.top;
			state.camera.x = mx - ((mx - state.camera.x) / old) * state.camera.scale;
			state.camera.y = my - ((my - state.camera.y) / old) * state.camera.scale;
			draw();
		},
		{ passive: false },
	);
	canvas.addEventListener("click", worldClick);
}

function setTab(name) {
	document.querySelectorAll(".tabs button").forEach((button) => {
		button.classList.toggle("active", button.dataset.tab === name);
	});
	document.querySelectorAll(".tab-panel").forEach((panel) => {
		panel.classList.toggle("active", panel.id === `tab-${name}`);
	});
}

function loop(timestamp) {
	if (!state.lastTick) state.lastTick = timestamp;
	const rate = state.speed === 3 ? 450 : state.speed === 2 ? 850 : 1500;
	if (timestamp - state.lastTick > rate) {
		state.lastTick = timestamp;
		simulateYear();
		render();
	}
	requestAnimationFrame(loop);
}

async function initModelCache() {
	if (!ui.modelLoader) return;
	try {
		showModelLoader("Loading...", "Checking browser cache", 0, "0%");
		const db = await openModelDb();
		const cached = await readModelMeta(db, GGUF_MODEL_KEY);
		if (
			cached?.complete &&
			cached.url === GGUF_MODEL_URL &&
			cached.size > 0 &&
			(await hasAllModelChunks(db, cached))
		) {
			showModelLoader("Loading...", "Using cached GGUF model", 1, "Cached");
			window.aicivModel = {
				key: GGUF_MODEL_KEY,
				url: GGUF_MODEL_URL,
				size: cached.size,
				cached: true,
				openBlob: () => modelBlobFromCache(db, GGUF_MODEL_KEY),
			};
			await initLocalGgufRuntime(db);
			hideModelLoader();
			return;
		}
		if (cached)
			showModelLoader(
				"Loading...",
				"Refreshing incomplete GGUF cache",
				0,
				"Repairing cache",
			);
		await clearModelCache(db, GGUF_MODEL_KEY);
		await downloadModelToIndexedDb(db);
		const meta = await readModelMeta(db, GGUF_MODEL_KEY);
		window.aicivModel = {
			key: GGUF_MODEL_KEY,
			url: GGUF_MODEL_URL,
			size: meta?.size || 0,
			cached: true,
			openBlob: () => modelBlobFromCache(db, GGUF_MODEL_KEY),
		};
		showModelLoader("Loading...", "GGUF cached in browser", 1, "Cached");
		await initLocalGgufRuntime(db);
		hideModelLoader();
	} catch (error) {
		console.warn("Model cache failed; continuing with simulation.", error);
		showModelLoader(
			"Loading...",
			"Model cache failed; simulation keeps running",
			1,
			"Offline fallback",
		);
		await delay(900);
		hideModelLoader();
	}
}

async function initLocalGgufRuntime(db) {
	try {
		showModelLoader(
			"Loading...",
			"Loading local GGUF AI",
			1,
			"Preparing runtime",
		);
		const [{ Wllama, LoggerWithoutDebug }, { default: WasmFromCDN }] =
			await Promise.all([
				import(`${WLLAMA_BASE_URL}/index.js`),
				import(`${WLLAMA_BASE_URL}/wasm-from-cdn.js`),
			]);
		const modelBlob = await modelBlobFromCache(db, GGUF_MODEL_KEY);
		const wllama = new Wllama(
			{
				default: `${WLLAMA_BASE_URL}/`,
				...WasmFromCDN,
			},
			{
				logger: LoggerWithoutDebug,
				suppressNativeLog: true,
				parallelDownloads: MODEL_PARALLEL_DOWNLOADS,
				allowOffline: true,
			},
		);
		await wllama.loadModel([modelBlob], {
			n_ctx: 2048,
			n_threads: Math.max(1, Math.min(4, navigator.hardwareConcurrency || 2)),
			n_batch: 256,
			warmup: true,
		});
		state.localAi = wllama;
		state.localAiReady = true;
		ui.workerStatus.textContent = "GGUF ready";
		ui.workerStatus.className = "online";
		showModelLoader("Loading...", "Local GGUF AI ready", 1, "Ready");
		await delay(220);
	} catch (error) {
		state.localAi = null;
		state.localAiReady = false;
		console.warn(
			"Local GGUF runtime failed; AI turns will use fallback routing.",
			error,
		);
		showModelLoader(
			"Loading...",
			"Local GGUF failed; simulation keeps running",
			1,
			"Fallback",
		);
		await delay(900);
	}
}

async function downloadModelToIndexedDb(db) {
	const info = await getRemoteModelInfo();
	await writeModelMeta(db, {
		key: GGUF_MODEL_KEY,
		url: GGUF_MODEL_URL,
		size: info.size,
		chunkSize: MODEL_CHUNK_SIZE,
		chunks: Math.ceil(info.size / MODEL_CHUNK_SIZE),
		complete: false,
		updatedAt: Date.now(),
	});
	if (info.size && info.acceptsRanges) {
		try {
			await downloadModelInRanges(db, info.size);
		} catch (error) {
			console.warn(
				"Segmented model download failed; retrying as a streamed download.",
				error,
			);
			await clearModelCache(db, GGUF_MODEL_KEY);
			await writeModelMeta(db, {
				key: GGUF_MODEL_KEY,
				url: GGUF_MODEL_URL,
				size: info.size,
				chunkSize: MODEL_CHUNK_SIZE,
				chunks: Math.ceil(info.size / MODEL_CHUNK_SIZE),
				complete: false,
				updatedAt: Date.now(),
			});
			await downloadModelStream(db, info.size);
		}
	} else {
		await downloadModelStream(db, info.size);
	}
	const meta = await readModelMeta(db, GGUF_MODEL_KEY);
	await writeModelMeta(db, { ...meta, complete: true, updatedAt: Date.now() });
}

async function getRemoteModelInfo() {
	try {
		const response = await fetch(GGUF_MODEL_URL, {
			method: "HEAD",
			cache: "no-store",
		});
		if (!response.ok) throw new Error(`HEAD ${response.status}`);
		const size = Number(response.headers.get("content-length")) || 0;
		const acceptsRanges = response.headers.get("accept-ranges") === "bytes";
		return { size, acceptsRanges };
	} catch (error) {
		console.warn(
			"Model HEAD failed; falling back to streamed download.",
			error,
		);
		return { size: 0, acceptsRanges: false };
	}
}

async function downloadModelInRanges(db, size) {
	const ranges = [];
	for (
		let start = 0, index = 0;
		start < size;
		start += MODEL_CHUNK_SIZE, index += 1
	) {
		ranges.push({
			index,
			start,
			end: Math.min(size - 1, start + MODEL_CHUNK_SIZE - 1),
		});
	}
	let downloaded = 0;
	let next = 0;
	showModelLoader(
		"Loading...",
		"Downloading GGUF model",
		0,
		`0% of ${formatBytes(size)}`,
	);
	async function worker() {
		while (next < ranges.length) {
			const range = ranges[next];
			next += 1;
			const buffer = await fetchModelRange(range.start, range.end);
			await writeModelChunk(db, GGUF_MODEL_KEY, range.index, buffer);
			downloaded += buffer.byteLength;
			updateModelProgress(
				downloaded,
				size,
				`${formatBytes(downloaded)} / ${formatBytes(size)}`,
			);
		}
	}
	await Promise.all(
		Array.from(
			{ length: Math.min(MODEL_PARALLEL_DOWNLOADS, ranges.length) },
			worker,
		),
	);
}

async function fetchModelRange(start, end) {
	const response = await fetch(GGUF_MODEL_URL, {
		headers: { range: `bytes=${start}-${end}` },
		cache: "no-store",
	});
	if (response.status !== 206)
		throw new Error(`Range request failed with ${response.status}`);
	return response.arrayBuffer();
}

async function downloadModelStream(db, knownSize) {
	const response = await fetch(GGUF_MODEL_URL, { cache: "no-store" });
	if (!response.ok) throw new Error(`Download ${response.status}`);
	const total =
		knownSize || Number(response.headers.get("content-length")) || 0;
	const reader = response.body?.getReader();
	if (!reader)
		throw new Error("Readable downloads are not supported in this browser.");
	let downloaded = 0;
	let chunkIndex = 0;
	let pending = new Uint8Array(0);
	showModelLoader(
		"Loading...",
		"Downloading GGUF model",
		0,
		total ? `0% of ${formatBytes(total)}` : "Starting",
	);
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		pending = joinBytes(pending, value);
		while (pending.byteLength >= MODEL_CHUNK_SIZE) {
			await writeModelChunk(
				db,
				GGUF_MODEL_KEY,
				chunkIndex,
				pending.slice(0, MODEL_CHUNK_SIZE).buffer,
			);
			pending = pending.slice(MODEL_CHUNK_SIZE);
			chunkIndex += 1;
		}
		downloaded += value.byteLength;
		updateModelProgress(
			downloaded,
			total,
			total
				? `${formatBytes(downloaded)} / ${formatBytes(total)}`
				: formatBytes(downloaded),
		);
	}
	if (pending.byteLength)
		await writeModelChunk(db, GGUF_MODEL_KEY, chunkIndex, pending.buffer);
	const meta = await readModelMeta(db, GGUF_MODEL_KEY);
	await writeModelMeta(db, {
		...meta,
		size: total || downloaded,
		chunks: chunkIndex + (pending.byteLength ? 1 : 0),
	});
}

function openModelDb() {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(MODEL_DB_NAME, MODEL_DB_VERSION);
		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains("meta"))
				db.createObjectStore("meta", { keyPath: "key" });
			if (!db.objectStoreNames.contains("chunks"))
				db.createObjectStore("chunks", { keyPath: "id" });
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

function readModelMeta(db, key) {
	return idbRequest(
		db.transaction("meta", "readonly").objectStore("meta").get(key),
	);
}

function writeModelMeta(db, meta) {
	return idbRequest(
		db.transaction("meta", "readwrite").objectStore("meta").put(meta),
	);
}

function writeModelChunk(db, key, index, buffer) {
	return idbRequest(
		db
			.transaction("chunks", "readwrite")
			.objectStore("chunks")
			.put({
				id: `${key}:${index}`,
				key,
				index,
				buffer,
			}),
	);
}

async function clearModelCache(db, key) {
	const meta = await readModelMeta(db, key);
	if (meta?.chunks) {
		await Promise.all(
			Array.from({ length: meta.chunks }, (_, index) =>
				idbRequest(
					db
						.transaction("chunks", "readwrite")
						.objectStore("chunks")
						.delete(`${key}:${index}`),
				),
			),
		);
	}
	await idbRequest(
		db.transaction("meta", "readwrite").objectStore("meta").delete(key),
	);
}

async function modelBlobFromCache(db, key) {
	const meta = await readModelMeta(db, key);
	if (!meta?.complete) throw new Error("Cached model is incomplete.");
	const parts = [];
	for (let index = 0; index < meta.chunks; index += 1) {
		const chunk = await idbRequest(
			db
				.transaction("chunks", "readonly")
				.objectStore("chunks")
				.get(`${key}:${index}`),
		);
		if (!chunk) throw new Error(`Missing cached model chunk ${index}.`);
		parts.push(chunk.buffer);
	}
	return new Blob(parts, { type: "application/octet-stream" });
}

async function hasAllModelChunks(db, meta) {
	if (!meta?.chunks) return false;
	for (let index = 0; index < meta.chunks; index += 1) {
		const chunk = await idbRequest(
			db
				.transaction("chunks", "readonly")
				.objectStore("chunks")
				.get(`${meta.key}:${index}`),
		);
		if (!chunk?.buffer) return false;
	}
	return true;
}

function idbRequest(request) {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

function showModelLoader(title, detail, progress, meta) {
	ui.modelLoader.classList.remove("hidden");
	ui.modelLoaderTitle.textContent = title;
	ui.modelLoaderDetail.textContent = detail;
	updateModelProgressBar(progress, meta);
}

function hideModelLoader() {
	ui.modelLoader.classList.add("hidden");
}

function updateModelProgress(downloaded, total, meta) {
	updateModelProgressBar(total ? downloaded / total : 0, meta);
}

function updateModelProgressBar(progress, meta) {
	const pct = clamp(progress || 0, 0, 1);
	ui.modelLoaderBar.style.width = `${Math.round(pct * 100)}%`;
	ui.modelLoaderMeta.textContent = meta || `${Math.round(pct * 100)}%`;
}

function joinBytes(a, b) {
	const out = new Uint8Array(a.byteLength + b.byteLength);
	out.set(a, 0);
	out.set(b, a.byteLength);
	return out;
}

function formatBytes(bytes) {
	if (!bytes) return "0 B";
	const units = ["B", "KB", "MB", "GB"];
	const index = Math.min(
		units.length - 1,
		Math.floor(Math.log(bytes) / Math.log(1024)),
	);
	return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function delay(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function init() {
	generateWorld();
	bindDrag();
	resizeCanvas();
	render();
	requestAnimationFrame(loop);
	initModelCache();
}

document.querySelectorAll(".tabs button").forEach((button) => {
	button.addEventListener("click", () => setTab(button.dataset.tab));
});
ui.askCouncil.addEventListener("click", () => {
	const index = mapModes.indexOf(state.mapMode);
	state.mapMode = mapModes[(index + 1) % mapModes.length];
	render();
});
document.getElementById("endSeason").addEventListener("click", () => {
	for (let i = 0; i < 10; i += 1) simulateYear();
	render();
});
document.getElementById("buildFarm").addEventListener("click", () => {
	state.paused = !state.paused;
	document.getElementById("buildFarm").textContent = state.paused
		? "Resume"
		: "Pause";
});
document.getElementById("buildForge").addEventListener("click", () => {
	state.speed = 1;
});
document.getElementById("buildLibrary").addEventListener("click", () => {
	state.speed = 2;
});
document.getElementById("sendScout").addEventListener("click", () => {
	state.speed = 3;
});
window.addEventListener("resize", () => {
	resizeCanvas();
	centerCamera();
	render();
});

init();
