const canvas = document.getElementById("world");
const ctx = canvas.getContext("2d");

const pauseBtn = document.getElementById("pauseBtn");
const addHumanBtn = document.getElementById("addHumanBtn");
const clearToolBtn = document.getElementById("clearToolBtn");
const thoughtsBtn = document.getElementById("thoughtsBtn");
const customBuildingNameInput = document.getElementById("customBuildingName");
const buildPaletteEl = document.getElementById("buildPalette");
const buildHintEl = document.getElementById("buildHint");

const dayLabel = document.getElementById("dayLabel");
const timeLabel = document.getElementById("timeLabel");
const moodLabel = document.getElementById("moodLabel");
const thoughtCountLabel = document.getElementById("thoughtCountLabel");
const selectedHumanEl = document.getElementById("selectedHuman");
const cityStatsEl = document.getElementById("cityStats");
const eventLogEl = document.getElementById("eventLog");

const firstNames = ["Maya", "Owen", "Rin", "Theo", "Lena", "Aria", "Jonah", "Nia", "Milo", "Kei", "Sora", "Iris", "Ezra", "Nova", "Jules", "Cass"];
const lastNames = ["Stone", "Vale", "Quinn", "Marsh", "Loft", "Reed", "Frost", "Hart", "Bloom", "Rowe", "Wilder", "Dune"];
const roles = ["maker", "chef", "gardener", "planner", "repairer", "seller", "driver", "teacher", "medic", "coder", "bartender", "custodian"];

const buildingCatalog = {
  home: { label: "Homes", short: "HOME", emoji: "🏠", color: "#e4ab6c", w: 132, h: 92, category: "Housing", capacity: 8, housing: 8 },
  apartment: { label: "Apartments", short: "APT", emoji: "🏢", color: "#c89260", w: 128, h: 118, category: "Housing", capacity: 18, housing: 18, rent: 6 },
  office: { label: "Office", short: "WORK", emoji: "🏢", color: "#7da3d8", w: 170, h: 108, category: "Jobs", jobs: 16 },
  shop: { label: "Shops", short: "SHOP", emoji: "🛍️", color: "#9bc56f", w: 142, h: 92, category: "Commerce", jobs: 10, food: 12 },
  park: { label: "Park", short: "PARK", emoji: "🌳", color: "#79c886", w: 176, h: 118, category: "Nature", greenery: 16, appeal: 8 },
  plaza: { label: "Plaza", short: "PLAZA", emoji: "🏛️", color: "#ccb28d", w: 118, h: 84, category: "Social", social: 12, appeal: 5 },
  cafe: { label: "Cafe", short: "CAFE", emoji: "☕", color: "#d9896c", w: 126, h: 86, category: "Social", jobs: 6, social: 10, nightlife: 4 },
  school: { label: "School", short: "SCH", emoji: "🏫", color: "#f2cf78", w: 156, h: 98, category: "Service", education: 16, jobs: 10 },
  hospital: { label: "Hospital", short: "MED", emoji: "🏥", color: "#7fc9c5", w: 160, h: 104, category: "Service", health: 20, jobs: 14 },
  police: { label: "Police", short: "SAFE", emoji: "🚓", color: "#5f7fcf", w: 142, h: 90, category: "Service", safety: 18, jobs: 8 },
  station: { label: "Transit", short: "RAIL", emoji: "🚉", color: "#8e93a8", w: 164, h: 96, category: "Transit", transit: 18, jobs: 7 },
  factory: { label: "Factory", short: "IND", emoji: "🏭", color: "#87786f", w: 174, h: 116, category: "Industry", jobs: 22, pollution: 18, traffic: 12 },
  bar: { label: "Bar", short: "BAR", emoji: "🍸", color: "#b87ca6", w: 118, h: 82, category: "Nightlife", jobs: 7, nightlife: 12, crime: 5 },
  landfill: { label: "Landfill", short: "WASTE", emoji: "🗑️", color: "#7b8a54", w: 168, h: 102, category: "Utility", pollution: 24, traffic: 8 },
  shelter: { label: "Shelter", short: "AID", emoji: "🛏️", color: "#8ea6b5", w: 142, h: 92, category: "Support", support: 14, housing: 6, health: 4 },
};

const paletteOrder = ["road", "home", "apartment", "office", "shop", "park", "school", "hospital", "police", "station", "factory", "bar", "landfill", "shelter"];

const world = {
  width: canvas.width,
  height: canvas.height,
  timeMinutes: 6 * 60,
  day: 1,
  paused: false,
  showThoughts: true,
  selectedHumanId: null,
  activeTool: "road",
  roadDraft: null,
  events: [],
  humans: [],
  buildings: [],
  roads: [],
  buildingCounter: 0,
  city: {
    budget: 78,
    crime: 22,
    pollution: 18,
    traffic: 20,
    rentPressure: 24,
    homelessness: 4,
    transit: 0,
    safety: 0,
    health: 0,
    education: 0,
    greenery: 0,
    jobs: 0,
    housing: 0,
    nightlife: 0,
    support: 0,
    demand: 22,
    vibe: 62,
    lastEventDay: 0,
  },
};

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function choose(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function formatTime(totalMinutes) {
  const minutes = Math.floor(totalMinutes % (24 * 60));
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function getBuildingsByKind(kind) {
  return world.buildings.filter((building) => building.kind === kind);
}

function getBuildingById(id) {
  return world.buildings.find((building) => building.id === id) || null;
}

function getBuildingCenter(building) {
  return { x: building.x + building.w / 2, y: building.y + building.h / 2 };
}

function distanceToRect(x, y, building) {
  const dx = Math.max(building.x - x, 0, x - (building.x + building.w));
  const dy = Math.max(building.y - y, 0, y - (building.y + building.h));
  return Math.hypot(dx, dy);
}

function nearestBuilding(kindOrKinds, x, y) {
  const kinds = Array.isArray(kindOrKinds) ? kindOrKinds : [kindOrKinds];
  let closest = null;
  let bestDistance = Infinity;

  for (const building of world.buildings) {
    if (!kinds.includes(building.kind)) {
      continue;
    }
    const center = getBuildingCenter(building);
    const distance = Math.hypot(center.x - x, center.y - y);
    if (distance < bestDistance) {
      bestDistance = distance;
      closest = building;
    }
  }

  return closest;
}

function makeBuilding(kind, x, y, name) {
  const preset = buildingCatalog[kind];
  const building = {
    id: `building-${world.buildingCounter}`,
    kind,
    x,
    y,
    w: preset.w,
    h: preset.h,
    color: preset.color,
    name: name || `${preset.label} ${world.buildingCounter + 1}`,
  };
  world.buildingCounter += 1;
  return building;
}

function roadKey(road) {
  const ax = Math.round(road.x1);
  const ay = Math.round(road.y1);
  const bx = Math.round(road.x2);
  const by = Math.round(road.y2);
  return ax < bx || (ax === bx && ay <= by)
    ? `${ax},${ay}-${bx},${by}`
    : `${bx},${by}-${ax},${ay}`;
}

function addRoad(x1, y1, x2, y2) {
  const snapped = {
    x1: clamp(Math.round(x1 / 20) * 20, 10, canvas.width - 10),
    y1: clamp(Math.round(y1 / 20) * 20, 10, canvas.height - 10),
    x2: clamp(Math.round(x2 / 20) * 20, 10, canvas.width - 10),
    y2: clamp(Math.round(y2 / 20) * 20, 10, canvas.height - 10),
  };

  if (Math.hypot(snapped.x2 - snapped.x1, snapped.y2 - snapped.y1) < 14) {
    return false;
  }

  const key = roadKey(snapped);
  if (world.roads.some((road) => roadKey(road) === key)) {
    return false;
  }

  world.roads.push({
    id: `road-${world.roads.length}`,
    ...snapped,
  });
  recalculateCityMetrics();
  return true;
}

function addBuilding(kind, x, y, name) {
  const building = makeBuilding(kind, x, y, name);
  world.buildings.push(building);
  rebalanceAssignments();
  recalculateCityMetrics();
  logEvent(world.buildings.length === 1
    ? `${building.name} is the first piece of your new city.`
    : `${building.name} opened in the city.`);
  return building;
}

function isPlacementValid(x, y, kind) {
  const preset = buildingCatalog[kind];
  const placed = {
    x: clamp(x - preset.w / 2, 20, canvas.width - preset.w - 20),
    y: clamp(y - preset.h / 2, 24, canvas.height - preset.h - 24),
    w: preset.w,
    h: preset.h,
  };

  for (const building of world.buildings) {
    const overlapX = placed.x < building.x + building.w + 18 && placed.x + placed.w > building.x - 18;
    const overlapY = placed.y < building.y + building.h + 18 && placed.y + placed.h > building.y - 18;
    if (overlapX && overlapY) {
      return null;
    }
  }

  if (world.roads.length > 0 && kind !== "park" && !roadNearBuilding(placed)) {
    return null;
  }

  return placed;
}

function roadNearBuilding(building) {
  return world.roads.some((road) => {
    const distances = [
      distancePointToSegment(building.x, building.y, road),
      distancePointToSegment(building.x + building.w, building.y, road),
      distancePointToSegment(building.x, building.y + building.h, road),
      distancePointToSegment(building.x + building.w, building.y + building.h, road),
      distancePointToSegment(building.x + building.w / 2, building.y + building.h / 2, road),
    ];
    return Math.min(...distances) < 42;
  });
}

function distancePointToSegment(px, py, road) {
  const x1 = road.x1;
  const y1 = road.y1;
  const x2 = road.x2;
  const y2 = road.y2;
  const vx = x2 - x1;
  const vy = y2 - y1;
  const lenSq = vx * vx + vy * vy;
  if (lenSq === 0) {
    return Math.hypot(px - x1, py - y1);
  }
  const t = clamp(((px - x1) * vx + (py - y1) * vy) / lenSq, 0, 1);
  const sx = x1 + t * vx;
  const sy = y1 + t * vy;
  return Math.hypot(px - sx, py - sy);
}

function logEvent(text) {
  world.events.unshift({
    id: `${Date.now()}-${Math.random()}`,
    time: `Day ${world.day}, ${formatTime(world.timeMinutes)}`,
    text,
  });
  world.events = world.events.slice(0, 22);
  renderEventLog();
}

function makeMemory(human, text, weight = 1) {
  human.memories.unshift({
    time: `D${world.day} ${formatTime(world.timeMinutes)}`,
    text,
    weight,
  });
  human.memories = human.memories.slice(0, 7);
}

function setThought(human, text) {
  human.currentThought = text;
}

function homeCandidates() {
  return world.buildings.filter((building) => ["home", "apartment", "shelter"].includes(building.kind));
}

function jobCandidates() {
  return world.buildings.filter((building) => ["office", "shop", "school", "hospital", "police", "station", "factory", "cafe", "bar"].includes(building.kind));
}

function pickHome(index) {
  const homes = homeCandidates();
  return homes[index % homes.length] || world.buildings[0];
}

function pickWork(index, startX, startY) {
  const jobs = jobCandidates();
  return jobs[index % jobs.length] || nearestBuilding("office", startX, startY) || world.buildings[0];
}

function createHuman(index = world.humans.length) {
  const home = pickHome(index);
  const start = getBuildingCenter(home);
  const work = pickWork(index, start.x, start.y);

  const human = {
    id: `human-${index}-${Math.random().toString(36).slice(2, 7)}`,
    name: `${choose(firstNames)} ${choose(lastNames)}`,
    role: choose(roles),
    x: start.x + rand(-18, 18),
    y: start.y + rand(-18, 18),
    homeId: home.id,
    workId: work.id,
    target: { x: start.x, y: start.y, buildingId: home.id },
    currentBuildingId: home.id,
    action: "settling in",
    goal: "understand the city",
    currentThought: "I should figure out how this city feels.",
    color: `hsl(${Math.floor(rand(8, 360))} 72% 58%)`,
    speed: rand(28, 42),
    radius: 8,
    hunger: rand(56, 88),
    energy: rand(60, 95),
    social: rand(45, 82),
    mood: rand(48, 80),
    stress: rand(12, 42),
    money: Math.floor(rand(12, 60)),
    health: rand(58, 92),
    safety: rand(45, 82),
    curiosity: rand(0.2, 1),
    diligence: rand(0.2, 1),
    sociability: rand(0.2, 1),
    boldness: rand(0.2, 1),
    relations: {},
    memories: [],
    decisionCooldown: rand(0.1, 2.4),
    activityTimer: 0,
    chatCooldown: rand(0, 6),
    lastRentDay: 0,
  };

  makeMemory(human, `Woke up in ${home.name}.`);
  return human;
}

function initializePopulation() {
  recalculateCityMetrics();
  logEvent("The land is empty. Start building from zero.");
  logEvent("Housing brings residents. Jobs, parks, transit, and services shape what kind of city they get.");
}

function getSelectedHuman() {
  return world.humans.find((human) => human.id === world.selectedHumanId) || null;
}

function needScore(human, key) {
  if (key === "eat") {
    return (100 - human.hunger) * (0.9 + human.boldness * 0.2);
  }
  if (key === "rest") {
    return (100 - human.energy) * (1 + (1 - human.boldness) * 0.2);
  }
  if (key === "socialize") {
    return (100 - human.social) * (0.7 + human.sociability * 0.6);
  }
  if (key === "relax") {
    return human.stress * (0.72 + human.curiosity * 0.4) + world.city.pollution * 0.12;
  }
  if (key === "health") {
    return (100 - human.health) + world.city.pollution * 0.18;
  }
  if (key === "safety") {
    return (100 - human.safety) + world.city.crime * 0.35;
  }
  return 0;
}

function assignGoal(human, goal, action, thought, buildingId) {
  const targetBuilding = getBuildingById(buildingId);
  if (!targetBuilding) {
    return;
  }

  human.goal = goal;
  human.action = action;
  human.currentBuildingId = null;
  const center = getBuildingCenter(targetBuilding);
  human.target = {
    x: center.x + rand(-18, 18),
    y: center.y + rand(-18, 18),
    buildingId,
  };
  setThought(human, thought);
}

function getServiceTarget(kindOrKinds, human) {
  const target = nearestBuilding(kindOrKinds, human.x, human.y);
  return target || getBuildingById(human.homeId);
}

function think(human) {
  const hour = (world.timeMinutes % (24 * 60)) / 60;
  const eatUrgency = needScore(human, "eat");
  const restUrgency = needScore(human, "rest");
  const socialUrgency = needScore(human, "socialize");
  const relaxUrgency = needScore(human, "relax");
  const healthUrgency = needScore(human, "health");
  const safetyUrgency = needScore(human, "safety");

  if (human.money < 5 && world.city.support > 0) {
    const shelter = getServiceTarget("shelter", human);
    assignGoal(human, "get help", "seeking support", "I need somewhere safe and low cost for a minute.", shelter.id);
    return;
  }

  if (eatUrgency > 38) {
    const foodPlace = getServiceTarget(["shop", "cafe"], human);
    assignGoal(human, "find food", "heading out to eat", "I'm getting hungry. Food comes first.", foodPlace.id);
    return;
  }

  if (healthUrgency > 44) {
    const clinic = getServiceTarget(["hospital", "shelter"], human);
    assignGoal(human, "feel better", "finding care", "I need some relief before this gets worse.", clinic.id);
    return;
  }

  if (safetyUrgency > 48 && world.city.safety > 0) {
    const safePlace = getServiceTarget(["police", "plaza", "home"], human);
    assignGoal(human, "feel safe", "moving toward a safer block", "Too much tension out here. I need a calmer block.", safePlace.id);
    return;
  }

  if (restUrgency > 45 || (hour >= 21 && human.energy < 72)) {
    assignGoal(human, "rest", "going home", "I'm running low. Home sounds good.", human.homeId);
    return;
  }

  if (hour >= 7.5 && hour <= 17.5 && human.energy > 25 && human.hunger > 20) {
    if (human.diligence > 0.3 || human.money < 18) {
      assignGoal(human, "earn money", "commuting to work", "I should keep my spot and earn something today.", human.workId);
      return;
    }
  }

  if (socialUrgency > 28) {
    const target = human.sociability > 0.56 ? getServiceTarget(["cafe", "bar"], human) : getServiceTarget(["plaza", "park"], human);
    assignGoal(human, "connect with someone", "looking for people", "I need a real conversation.", target.id);
    return;
  }

  if (relaxUrgency > 24) {
    const greenPlace = getServiceTarget(["park", "plaza"], human);
    assignGoal(human, "clear my head", "walking somewhere calmer", "A slower rhythm might reset me.", greenPlace.id);
    return;
  }

  if (human.curiosity > 0.58 && Math.random() < 0.45) {
    const roamKinds = ["park", "plaza", "shop", "cafe", "station", "school", "bar"];
    const possible = world.buildings.filter((building) => roamKinds.includes(building.kind));
    const roamTarget = choose(possible.length > 0 ? possible : world.buildings);
    assignGoal(human, "see what is happening", "exploring", `I wonder what the mood is like near ${roamTarget.name}.`, roamTarget.id);
    return;
  }

  assignGoal(human, "spend quiet time", "staying near home", "A little unstructured time sounds nice.", human.homeId);
}

function arriveAtDestination(human) {
  human.currentBuildingId = human.target.buildingId;
  human.activityTimer = rand(4, 12);
  const destination = getBuildingById(human.currentBuildingId);
  if (!destination) {
    return;
  }

  switch (destination.kind) {
    case "shop":
      human.action = "buying food";
      human.goal = "restore hunger";
      setThought(human, "A good meal fixes a lot.");
      makeMemory(human, `Stopped by ${destination.name} for food.`);
      break;
    case "office":
    case "school":
    case "hospital":
    case "police":
    case "station":
    case "factory":
    case "cafe":
    case "bar":
      human.action = destination.kind === "bar" ? "lingering late" : "working";
      human.goal = destination.kind === "bar" ? "blow off steam" : "earn money";
      setThought(human, destination.kind === "factory" ? "The air is rough, but the pay is real." : `I should make this stop count at ${destination.name}.`);
      makeMemory(human, `Spent time at ${destination.name}.`);
      break;
    case "park":
    case "plaza":
      human.action = "hanging around";
      human.goal = "reduce stress";
      setThought(human, "This block feels easier to breathe in.");
      makeMemory(human, `Spent a little time at ${destination.name}.`);
      break;
    case "shelter":
      human.action = "recovering";
      human.goal = "stabilize";
      setThought(human, "At least I can regroup here.");
      makeMemory(human, `Found support at ${destination.name}.`);
      break;
    default:
      human.action = "resting";
      human.goal = "recover energy";
      setThought(human, "Home is where I can finally exhale.");
      makeMemory(human, "Returned home to recover.");
      break;
  }
}

function updateActivity(human, dt) {
  if (human.activityTimer > 0) {
    human.activityTimer -= dt;
  }

  const current = getBuildingById(human.currentBuildingId);
  const kind = current ? current.kind : null;

  if (kind === "shop" || kind === "cafe") {
    human.hunger = clamp(human.hunger + 13 * dt, 0, 100);
    human.mood = clamp(human.mood + 2.8 * dt, 0, 100);
    human.money = clamp(human.money - 2.2 * dt, 0, 999);
  } else if (["office", "school", "hospital", "police", "station", "factory"].includes(kind)) {
    const pay = kind === "factory" ? 2.9 : 2.2;
    const strain = kind === "factory" ? 5 : 3.7;
    human.money = clamp(human.money + pay * dt, 0, 999);
    human.energy = clamp(human.energy - (5.2 + strain) * dt * 0.5, 0, 100);
    human.stress = clamp(human.stress + strain * dt, 0, 100);
  } else if (kind === "bar") {
    human.social = clamp(human.social + 6 * dt, 0, 100);
    human.stress = clamp(human.stress - 1.8 * dt, 0, 100);
    human.energy = clamp(human.energy - 2.6 * dt, 0, 100);
    human.money = clamp(human.money - 2.8 * dt, 0, 999);
  } else if (kind === "park" || kind === "plaza") {
    human.stress = clamp(human.stress - 7 * dt, 0, 100);
    human.mood = clamp(human.mood + 3.5 * dt, 0, 100);
  } else if (kind === "hospital" || kind === "shelter") {
    human.health = clamp(human.health + 9 * dt, 0, 100);
    human.stress = clamp(human.stress - 4 * dt, 0, 100);
  } else if (human.currentBuildingId === human.homeId) {
    human.energy = clamp(human.energy + 8.6 * dt, 0, 100);
    human.stress = clamp(human.stress - 3 * dt, 0, 100);
    human.mood = clamp(human.mood + 1.4 * dt, 0, 100);
  } else {
    human.mood = clamp(human.mood + 0.5 * dt, 0, 100);
  }

  if (human.activityTimer <= 0) {
    think(human);
  }
}

function applyCityPressure(human, dt) {
  human.hunger = clamp(human.hunger - 1.35 * dt, 0, 100);
  human.energy = clamp(human.energy - (0.82 + world.city.traffic * 0.003) * dt, 0, 100);
  human.social = clamp(human.social - 1.08 * dt, 0, 100);
  human.stress = clamp(human.stress + (0.42 + world.city.traffic * 0.004 + world.city.crime * 0.003) * dt, 0, 100);
  human.health = clamp(human.health - (world.city.pollution * 0.008) * dt, 0, 100);
  human.safety = clamp(human.safety - (world.city.crime * 0.01) * dt + (world.city.safety * 0.007) * dt, 0, 100);
}

function updateHuman(human, dt) {
  human.decisionCooldown -= dt;
  human.chatCooldown -= dt;

  applyCityPressure(human, dt);

  const isMoving = human.currentBuildingId === null;
  if (isMoving) {
    const dx = human.target.x - human.x;
    const dy = human.target.y - human.y;
    const distance = Math.hypot(dx, dy);
    const travel = (human.speed + world.city.transit * 0.1 - world.city.traffic * 0.05) * dt;

    if (distance <= travel) {
      human.x = human.target.x;
      human.y = human.target.y;
      arriveAtDestination(human);
    } else {
      human.x += (dx / distance) * travel;
      human.y += (dy / distance) * travel;
    }
  } else {
    updateActivity(human, dt);
  }

  if (human.decisionCooldown <= 0 && !isMoving && human.activityTimer <= 1.5) {
    human.decisionCooldown = rand(4, 8);
    think(human);
  }

  human.mood = clamp(
    0.28 * human.hunger +
    0.22 * human.energy +
    0.16 * human.social +
    0.16 * human.health +
    0.12 * human.safety -
    0.18 * human.stress -
    0.06 * world.city.pollution,
    0,
    100,
  );
}

function maybeChat(a, b) {
  if (a.chatCooldown > 0 || b.chatCooldown > 0) {
    return;
  }
  if (a.currentBuildingId === null || b.currentBuildingId === null) {
    return;
  }
  if (a.currentBuildingId !== b.currentBuildingId) {
    return;
  }
  if (Math.hypot(a.x - b.x, a.y - b.y) > 24) {
    return;
  }

  const affinity = ((a.relations[b.id] || 0) + (b.relations[a.id] || 0)) / 2;
  const chance = 0.16 + a.sociability * 0.18 + b.sociability * 0.18 + affinity * 0.02;
  if (Math.random() > chance) {
    return;
  }

  const delta = rand(3, 7);
  a.relations[b.id] = clamp((a.relations[b.id] || 0) + delta, -20, 100);
  b.relations[a.id] = clamp((b.relations[a.id] || 0) + delta, -20, 100);
  a.social = clamp(a.social + 16, 0, 100);
  b.social = clamp(b.social + 16, 0, 100);
  a.stress = clamp(a.stress - 6, 0, 100);
  b.stress = clamp(b.stress - 6, 0, 100);
  a.chatCooldown = rand(12, 20);
  b.chatCooldown = rand(12, 20);

  const talkPlace = getBuildingById(a.currentBuildingId);
  const talkPlaceName = talkPlace ? talkPlace.name : "the street";
  setThought(a, `${b.name.split(" ")[0]} actually gets what I'm saying.`);
  setThought(b, `${a.name.split(" ")[0]} was good company.`);
  makeMemory(a, `Had a meaningful chat with ${b.name} at ${talkPlaceName}.`, 2);
  makeMemory(b, `Had a meaningful chat with ${a.name} at ${talkPlaceName}.`, 2);

  if (Math.random() < 0.2) {
    logEvent(`${a.name} and ${b.name} connected at ${talkPlaceName}.`);
  }
}

function rebalanceAssignments() {
  const homes = homeCandidates();
  const jobs = jobCandidates();

  for (let i = 0; i < world.humans.length; i += 1) {
    const human = world.humans[i];
    const home = homes.length > 0 ? homes[i % homes.length] : world.buildings[0];
    const job = jobs.length > 0 ? jobs[i % jobs.length] : home;
    human.homeId = home.id;
    human.workId = job.id;
    if (!getBuildingById(human.currentBuildingId)) {
      human.currentBuildingId = home.id;
      const center = getBuildingCenter(home);
      human.x = center.x;
      human.y = center.y;
      human.target = { x: center.x, y: center.y, buildingId: home.id };
    }
  }
}

function recalculateCityMetrics() {
  const totals = {
    jobs: 0,
    housing: 0,
    food: 0,
    greenery: 0,
    safety: 0,
    health: 0,
    education: 0,
    transit: 0,
    pollution: 0,
    traffic: 0,
    nightlife: 0,
    support: 0,
    crime: 0,
    rent: 0,
    appeal: 0,
  };

  for (const building of world.buildings) {
    const preset = buildingCatalog[building.kind];
    for (const key of Object.keys(totals)) {
      totals[key] += preset[key] || 0;
    }
  }

  const roadMiles = world.roads.reduce((sum, road) => sum + Math.hypot(road.x2 - road.x1, road.y2 - road.y1), 0) / 100;

  const population = world.humans.length;
  const averageMood = population > 0 ? world.humans.reduce((sum, human) => sum + human.mood, 0) / population : 0;
  const avgStress = population > 0 ? world.humans.reduce((sum, human) => sum + human.stress, 0) / population : 0;
  const avgHealth = population > 0 ? world.humans.reduce((sum, human) => sum + human.health, 0) / population : 0;
  const avgSafety = population > 0 ? world.humans.reduce((sum, human) => sum + human.safety, 0) / population : 0;
  const unemployment = Math.max(population - totals.jobs, 0);
  const unhoused = Math.max(population - totals.housing, 0);

  world.city.jobs = totals.jobs;
  world.city.housing = totals.housing;
  world.city.transit = clamp(totals.transit - population * 0.15, 0, 100);
  world.city.safety = clamp(totals.safety - totals.crime * 0.6, 0, 100);
  world.city.health = clamp(totals.health + avgHealth * 0.25 - totals.pollution * 0.35, 0, 100);
  world.city.education = clamp(totals.education, 0, 100);
  world.city.greenery = clamp(totals.greenery, 0, 100);
  world.city.nightlife = clamp(totals.nightlife, 0, 100);
  world.city.support = clamp(totals.support, 0, 100);
  world.city.crime = clamp(12 + unemployment * 1.3 + unhoused * 1.6 + totals.crime - world.city.safety * 0.35 + avgStress * 0.16, 0, 100);
  world.city.pollution = clamp(8 + totals.pollution - world.city.greenery * 0.28, 0, 100);
  world.city.traffic = clamp(4 + totals.traffic + population * 0.45 + roadMiles * 1.1 - world.city.transit * 0.5, 0, 100);
  world.city.rentPressure = clamp(16 + totals.rent + population * 0.8 - totals.housing * 0.6 + totals.appeal * 0.2, 0, 100);
  world.city.homelessness = clamp(unhoused * 4 - world.city.support * 0.7, 0, 100);
  world.city.demand = clamp(population * 1.5 + world.city.education * 0.3 + world.city.nightlife * 0.2 - world.city.pollution * 0.35, 0, 100);
  world.city.budget = clamp(
    55 +
    totals.jobs * 0.55 +
    totals.food * 0.3 +
    totals.education * 0.15 -
    totals.health * 0.22 -
    totals.safety * 0.18 -
    totals.transit * 0.22 -
    totals.support * 0.16 -
    world.city.pollution * 0.12,
    -99,
    999,
  );
  world.city.vibe = clamp(
    averageMood * 0.45 +
    world.city.greenery * 0.25 +
    world.city.health * 0.12 +
    world.city.safety * 0.12 -
    world.city.crime * 0.18 -
    world.city.pollution * 0.16 -
    world.city.traffic * 0.12,
    0,
    100,
  );
  return { averageMood, avgStress, avgHealth, avgSafety, roadMiles };
}

function dailyCityEvents() {
  recalculateCityMetrics();

  if (world.humans.length === 0) {
    logEvent(world.buildings.length === 0
      ? "The empty site is waiting for its first block."
      : "The city has structures now, but no residents have moved in yet.");
    return;
  }

  for (const human of world.humans) {
    const rentCost = 3 + world.city.rentPressure * 0.05;
    if (human.lastRentDay !== world.day) {
      human.money = clamp(human.money - rentCost, -20, 999);
      human.lastRentDay = world.day;
      if (human.money < 0) {
        human.stress = clamp(human.stress + 10, 0, 100);
        makeMemory(human, "Rent hit harder than expected today.");
      }
    }
  }

  const eventRoll = Math.random();
  if (world.city.crime > 60 && eventRoll < 0.34) {
    logEvent("A theft wave hit a few blocks overnight. People feel less safe this morning.");
    for (const human of world.humans) {
      human.safety = clamp(human.safety - rand(4, 9), 0, 100);
      human.stress = clamp(human.stress + rand(3, 7), 0, 100);
    }
  } else if (world.city.pollution > 60 && eventRoll < 0.52) {
    logEvent("Smog settled over the city and residents are feeling it.");
    for (const human of world.humans) {
      human.health = clamp(human.health - rand(3, 7), 0, 100);
      human.mood = clamp(human.mood - rand(2, 5), 0, 100);
    }
  } else if (world.city.homelessness > 26 && eventRoll < 0.7) {
    logEvent("More tents appeared overnight. Housing pressure is becoming impossible to ignore.");
  } else if (world.city.vibe > 72 && eventRoll < 0.85) {
    logEvent("A spontaneous street festival made the city feel alive today.");
    for (const human of world.humans) {
      human.social = clamp(human.social + rand(4, 8), 0, 100);
      human.mood = clamp(human.mood + rand(3, 7), 0, 100);
    }
  } else {
    logEvent(`Day ${world.day} begins. Demand is ${world.city.demand.toFixed(0)} and the city keeps reshaping itself.`);
  }
}

function updateCity(dt) {
  if (world.paused) {
    return;
  }

  world.timeMinutes += dt * 22;
  if (world.timeMinutes >= 24 * 60) {
    world.timeMinutes -= 24 * 60;
    world.day += 1;
    dailyCityEvents();
  }

  for (const human of world.humans) {
    updateHuman(human, dt);
  }

  for (let i = 0; i < world.humans.length; i += 1) {
    for (let j = i + 1; j < world.humans.length; j += 1) {
      maybeChat(world.humans[i], world.humans[j]);
    }
  }

  recalculateCityMetrics();
}

function drawDistrictBackdrop() {
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, "#9dd2eb");
  sky.addColorStop(0.34, "#c7e2ef");
  sky.addColorStop(0.341, "#d8c29b");
  sky.addColorStop(1, "#8ab072");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.beginPath();
  ctx.moveTo(0, 112);
  ctx.lineTo(canvas.width, 112);
  ctx.lineTo(canvas.width, 162);
  ctx.lineTo(0, 132);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(83, 144, 176, 0.9)";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(224, 0);
  ctx.lineTo(172, 138);
  ctx.lineTo(0, 116);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 1;
  for (let x = -180; x < canvas.width + 220; x += 86) {
    ctx.beginPath();
    ctx.moveTo(x, 132);
    ctx.lineTo(x + 220, canvas.height);
    ctx.stroke();
  }
  for (let y = 156; y < canvas.height; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y + 26);
    ctx.stroke();
  }
}

function drawRoadSegment(road, alpha = 1) {
  const dx = road.x2 - road.x1;
  const dy = road.y2 - road.y1;
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;
  const halfWidth = 11;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(25, 29, 36, 0.18)";
  ctx.beginPath();
  ctx.moveTo(road.x1 + nx * halfWidth + 5, road.y1 + ny * halfWidth + 5);
  ctx.lineTo(road.x2 + nx * halfWidth + 5, road.y2 + ny * halfWidth + 5);
  ctx.lineTo(road.x2 - nx * halfWidth + 5, road.y2 - ny * halfWidth + 5);
  ctx.lineTo(road.x1 - nx * halfWidth + 5, road.y1 - ny * halfWidth + 5);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(54, 56, 62, 0.88)";
  ctx.beginPath();
  ctx.moveTo(road.x1 + nx * halfWidth, road.y1 + ny * halfWidth);
  ctx.lineTo(road.x2 + nx * halfWidth, road.y2 + ny * halfWidth);
  ctx.lineTo(road.x2 - nx * halfWidth, road.y2 - ny * halfWidth);
  ctx.lineTo(road.x1 - nx * halfWidth, road.y1 - ny * halfWidth);
  ctx.closePath();
  ctx.fill();

  ctx.setLineDash([10, 10]);
  ctx.strokeStyle = "rgba(255, 248, 236, 0.72)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(road.x1, road.y1);
  ctx.lineTo(road.x2, road.y2);
  ctx.stroke();
  ctx.restore();
}

function drawRoads() {
  for (const road of world.roads) {
    drawRoadSegment(road);
  }
}

function drawRoadDraft() {
  if (world.activeTool !== "road" || !world.roadDraft || !world.pointer) {
    return;
  }

  const draft = { x1: world.roadDraft.x, y1: world.roadDraft.y, x2: world.pointer.x, y2: world.pointer.y };
  const dx = draft.x2 - draft.x1;
  const dy = draft.y2 - draft.y1;
  const length = Math.hypot(dx, dy);
  if (length < 4) {
    return;
  }

  drawRoadSegment(draft, 0.55);
}

function shadeColor(hex, amount) {
  const value = hex.replace("#", "");
  const size = value.length === 3 ? 1 : 2;
  const channels = [];

  for (let i = 0; i < value.length; i += size) {
    const part = value.slice(i, i + size);
    const channel = size === 1 ? parseInt(part + part, 16) : parseInt(part, 16);
    channels.push(clamp(Math.round(channel + amount), 0, 255));
  }

  return `rgb(${channels[0]}, ${channels[1]}, ${channels[2]})`;
}

function drawBuilding(building) {
  const preset = buildingCatalog[building.kind];
  const centerX = building.x + building.w / 2;
  const iconY = building.y + building.h / 2 - 8;
  const shadowY = building.y + building.h - 6;

  ctx.save();
  ctx.shadowColor = "rgba(31, 26, 18, 0.2)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = "rgba(255, 248, 236, 0.9)";
  ctx.beginPath();
  ctx.roundRect(building.x, building.y + 10, building.w, building.h - 10, 24);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = "rgba(31, 26, 18, 0.12)";
  ctx.beginPath();
  ctx.ellipse(centerX, shadowY, building.w * 0.36, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.font = "42px 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(preset.emoji, centerX, iconY);
  ctx.restore();

  ctx.fillStyle = "rgba(44, 36, 24, 0.92)";
  ctx.font = "700 14px 'Space Grotesk'";
  ctx.textAlign = "center";
  ctx.fillText(building.name, centerX, building.y + building.h - 22);

  ctx.font = "11px 'IBM Plex Mono'";
  ctx.fillStyle = "rgba(44, 36, 24, 0.68)";
  ctx.fillText(preset.short, centerX, building.y + building.h - 8);
  ctx.textAlign = "start";
}

function drawBuildings() {
  for (const building of world.buildings) {
    drawBuilding(building);
  }
}

function drawPlacementPreview() {
  if (!world.pointer || !world.activeTool) {
    return;
  }

  const valid = isPlacementValid(world.pointer.x, world.pointer.y, world.activeTool);
  const preset = buildingCatalog[world.activeTool];
  const x = clamp(world.pointer.x - preset.w / 2, 20, canvas.width - preset.w - 20);
  const y = clamp(world.pointer.y - preset.h / 2, 24, canvas.height - preset.h - 24);

  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = valid ? "rgba(255, 248, 236, 0.9)" : "rgba(208, 75, 75, 0.72)";
  ctx.beginPath();
  ctx.roundRect(x, y + 10, preset.w, preset.h - 10, 24);
  ctx.fill();
  ctx.fillStyle = valid ? "rgba(31, 26, 18, 0.1)" : "rgba(31, 26, 18, 0.08)";
  ctx.beginPath();
  ctx.ellipse(x + preset.w / 2, y + preset.h - 2, preset.w * 0.36, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = "42px 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(preset.emoji, x + preset.w / 2, y + preset.h / 2 - 8);
  ctx.textAlign = "start";
  ctx.restore();
}

function drawHumans() {
  for (const human of world.humans) {
    const isSelected = human.id === world.selectedHumanId;

    ctx.fillStyle = human.color;
    ctx.beginPath();
    ctx.arc(human.x, human.y, human.radius + (isSelected ? 2 : 0), 0, Math.PI * 2);
    ctx.fill();

    if (isSelected) {
      ctx.strokeStyle = "rgba(255, 248, 236, 0.95)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(human.x, human.y, human.radius + 6, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(44, 36, 24, 0.86)";
    ctx.font = "11px 'IBM Plex Mono'";
    ctx.fillText(human.name.split(" ")[0], human.x - 16, human.y - 14);

    if (world.showThoughts) {
      const thought = human.currentThought.length > 34
        ? `${human.currentThought.slice(0, 34)}...`
        : human.currentThought;
      const width = Math.max(90, thought.length * 6.5 + 20);
      const boxX = clamp(human.x - width / 2, 12, canvas.width - width - 12);
      const boxY = human.y - 56;

      ctx.fillStyle = "rgba(255, 248, 236, 0.88)";
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, width, 28, 12);
      ctx.fill();
      ctx.fillStyle = "rgba(44, 36, 24, 0.88)";
      ctx.font = "11px 'IBM Plex Mono'";
      ctx.fillText(thought, boxX + 10, boxY + 18);
    }
  }
}

function drawWorld() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawDistrictBackdrop();

  ctx.fillStyle = "rgba(255, 255, 255, 0.24)";
  ctx.fillRect(0, 0, canvas.width, 110);

  drawRoads();
  drawBuildings();
  drawPlacementPreview();
  drawRoadDraft();
  drawHumans();
}

function renderEventLog() {
  eventLogEl.innerHTML = world.events
    .map((event) => `<div class="event"><time>${event.time}</time><div>${event.text}</div></div>`)
    .join("");
}

function statCard(label, value) {
  return `<div class="stat"><p class="label">${label}</p><strong>${value}</strong></div>`;
}

function renderStats() {
  const metrics = recalculateCityMetrics();
  const atWork = world.humans.filter((human) => {
    const current = getBuildingById(human.currentBuildingId);
    return current && ["office", "school", "hospital", "police", "station", "factory", "shop", "cafe", "bar"].includes(current.kind);
  }).length;
  const atHome = world.humans.filter((human) => human.currentBuildingId === human.homeId).length;
  const outSocial = world.humans.filter((human) => {
    const current = getBuildingById(human.currentBuildingId);
    return current && ["cafe", "plaza", "park", "bar"].includes(current.kind);
  }).length;

  dayLabel.textContent = String(world.day);
  timeLabel.textContent = formatTime(world.timeMinutes);
  moodLabel.textContent = metrics.averageMood.toFixed(0);
  thoughtCountLabel.textContent = world.humans.filter((human) => human.currentThought).length;

  cityStatsEl.innerHTML = [
    statCard("Population", world.humans.length),
    statCard("Buildings", world.buildings.length),
    statCard("Roads", world.roads.length),
    statCard("At Work", atWork),
    statCard("At Home", atHome),
    statCard("Social", outSocial),
    statCard("Budget", world.city.budget.toFixed(0)),
    statCard("Housing", `${world.city.housing}/${world.humans.length}`),
    statCard("Jobs", `${world.city.jobs}/${world.humans.length}`),
    statCard("Crime", world.city.crime.toFixed(0)),
    statCard("Pollution", world.city.pollution.toFixed(0)),
    statCard("Traffic", world.city.traffic.toFixed(0)),
    statCard("Homelessness", world.city.homelessness.toFixed(0)),
  ].join("");
}

function relationRows(human) {
  const items = Object.entries(human.relations)
    .map(([id, value]) => ({
      human: world.humans.find((candidate) => candidate.id === id),
      value,
    }))
    .filter((entry) => entry.human)
    .sort((a, b) => b.value - a.value)
    .slice(0, 4);

  if (items.length === 0) {
    return `<div class="list-item">No strong ties yet.</div>`;
  }

  return items
    .map((entry) => `<div class="list-item">${entry.human.name}: ${entry.value.toFixed(0)} trust</div>`)
    .join("");
}

function memoryRows(human) {
  return human.memories
    .slice(0, 5)
    .map((memory) => `<div class="list-item"><div class="tiny">${memory.time}</div>${memory.text}</div>`)
    .join("");
}

function renderSelectedHuman() {
  const human = getSelectedHuman();
  if (!human) {
    selectedHumanEl.innerHTML = world.humans.length === 0
      ? "No residents yet. Build housing, then attract someone to start the city."
      : "Click a human to inspect their mind.";
    return;
  }

  const home = getBuildingById(human.homeId);
  const work = getBuildingById(human.workId);
  selectedHumanEl.innerHTML = `
    <div class="inspector-name">
      <div>
        <h3>${human.name}</h3>
        <p class="tiny">${human.role}</p>
      </div>
      <span class="pill">${human.action}</span>
    </div>
    <div class="thought-box">
      <p class="tiny">Current Thought</p>
      <p>${human.currentThought}</p>
    </div>
    <p><strong>Goal:</strong> ${human.goal}</p>
    <p><strong>Home:</strong> ${home ? home.name : "Unknown"}<br><strong>Work:</strong> ${work ? work.name : "Unknown"}</p>
    <p class="section-copy">Needs and feelings</p>
    <div class="meter-list">
      ${["hunger", "energy", "social", "health", "safety", "stress", "mood"]
        .map((key) => {
          const value = clamp(human[key], 0, 100);
          return `
            <div class="meter-row">
              <span class="tiny">${key}</span>
              <div class="bar"><div class="bar-fill" style="width:${value}%"></div></div>
              <span class="mono">${value.toFixed(0)}</span>
            </div>
          `;
        })
        .join("")}
    </div>
    <p class="section-copy">Traits</p>
    <div class="meter-list">
      ${["curiosity", "diligence", "sociability", "boldness"]
        .map((key) => {
          const value = clamp(human[key] * 100, 0, 100);
          return `
            <div class="meter-row">
              <span class="tiny">${key}</span>
              <div class="bar"><div class="bar-fill" style="width:${value}%"></div></div>
              <span class="mono">${value.toFixed(0)}</span>
            </div>
          `;
        })
        .join("")}
    </div>
    <p class="section-copy">Recent memories</p>
    <div class="memory-list">${memoryRows(human)}</div>
    <p class="section-copy">Relationships</p>
    <div class="relation-list">${relationRows(human)}</div>
  `;
}

function renderPalette() {
  buildPaletteEl.innerHTML = paletteOrder
    .map((kind) => {
      if (kind === "road") {
        const activeClass = world.activeTool === "road" ? "active-tool" : "secondary";
        return `<button class="${activeClass}" data-tool="road">🛣️ Roads<span>Infrastructure</span></button>`;
      }
      const preset = buildingCatalog[kind];
      const activeClass = world.activeTool === kind ? "active-tool" : "secondary";
      return `<button class="${activeClass}" data-tool="${kind}">${preset.emoji} ${preset.label}<span>${preset.category}</span></button>`;
    })
    .join("");

  for (const button of buildPaletteEl.querySelectorAll("button")) {
    button.addEventListener("click", () => {
      world.activeTool = button.dataset.tool;
      updateBuildHint();
      renderPalette();
    });
  }
}

function updateBuildHint() {
  if (!world.activeTool) {
    buildHintEl.textContent = world.humans.length === 0
      ? "Browse mode: start by placing housing or a park on the empty land."
      : "Browse mode: click people to inspect them.";
    clearToolBtn.classList.remove("active-tool");
    return;
  }
  if (world.activeTool === "road") {
    buildHintEl.textContent = "Road mode: click and drag to draw your street layout from scratch.";
    clearToolBtn.classList.add("active-tool");
    return;
  }
  const preset = buildingCatalog[world.activeTool];
  buildHintEl.textContent = `Placing ${preset.label}: click an open block on the map.`;
  clearToolBtn.classList.add("active-tool");
}

function findNearestHuman(mouseX, mouseY) {
  let closest = null;
  let bestDistance = Infinity;
  for (const human of world.humans) {
    const distance = Math.hypot(mouseX - human.x, mouseY - human.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      closest = human;
    }
  }
  return bestDistance < 22 ? closest : null;
}

function placeSelectedBuilding(mouseX, mouseY) {
  if (!world.activeTool) {
    return false;
  }

  const valid = isPlacementValid(mouseX, mouseY, world.activeTool);
  if (!valid) {
    logEvent("That block is too crowded. Try placing the building somewhere more open.");
    return true;
  }

  const customName = customBuildingNameInput.value.trim();
  addBuilding(world.activeTool, valid.x, valid.y, customName);
  customBuildingNameInput.value = "";
  return true;
}

canvas.addEventListener("mousemove", (event) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  world.pointer = {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
});

canvas.addEventListener("mouseleave", () => {
  world.pointer = null;
});

canvas.addEventListener("click", (event) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const mouseX = (event.clientX - rect.left) * scaleX;
  const mouseY = (event.clientY - rect.top) * scaleY;

  if (placeSelectedBuilding(mouseX, mouseY)) {
    renderStats();
    return;
  }

  const human = findNearestHuman(mouseX, mouseY);
  world.selectedHumanId = human ? human.id : null;
  renderSelectedHuman();
});

pauseBtn.addEventListener("click", () => {
  world.paused = !world.paused;
  pauseBtn.textContent = world.paused ? "Resume" : "Pause";
});

thoughtsBtn.addEventListener("click", () => {
  world.showThoughts = !world.showThoughts;
  thoughtsBtn.textContent = world.showThoughts ? "Hide Thoughts" : "Show Thoughts";
});

clearToolBtn.addEventListener("click", () => {
  world.activeTool = null;
  updateBuildHint();
  renderPalette();
});

addHumanBtn.addEventListener("click", () => {
  if (homeCandidates().length === 0) {
    logEvent("Build some housing first so a resident has somewhere to live.");
    return;
  }
  const human = createHuman(world.humans.length);
  world.humans.push(human);
  recalculateCityMetrics();
  logEvent(`${human.name} moved into the city.`);
  renderStats();
});

let lastTime = performance.now();
function frame(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  updateCity(dt);
  drawWorld();
  renderStats();
  renderSelectedHuman();
  requestAnimationFrame(frame);
}

initializePopulation();
renderPalette();
updateBuildHint();
renderStats();
renderSelectedHuman();
requestAnimationFrame(frame);
