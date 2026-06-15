const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const taskStrip = document.querySelector(".task-strip");
const tasksLabel = document.getElementById("tasksLabel");
const crewLabel = document.getElementById("crewLabel");
const stateLabel = document.getElementById("stateLabel");
const feed = document.getElementById("feed");
const overlay = document.getElementById("overlay");
const overlayEyebrow = document.getElementById("overlayEyebrow");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const restartButton = document.getElementById("restartButton");
const settingsButton = document.getElementById("settingsButton");
const settingsPanel = document.getElementById("settingsPanel");
const hitboxesToggle = document.getElementById("hitboxesToggle");

const WORLD = { width: 1560, height: 860 };
const PLAYER_RADIUS = 10;
const PLAYER_HITBOX_RADIUS = 6.5;
const MAX_COLLISION_STEP = 3.5;
const TASK_COUNT = 6;
const view = { width: 0, height: 0 };
const camera = { x: 0, y: 0, zoom: 4.25 };
const MAX_VISIBLE_WORLD = { width: 430, height: 270 };

const ASSET_URLS = {
  map: "./assets/amim/skeld-map.webp",
  crew: {
    cyan: "./assets/amim/cyan-mate.webp",
    red: "./assets/amim/red-mate.webp",
    yellow: "./assets/amim/yellow-mate.webp",
    lime: "./assets/amim/lime-mate.webp",
    pink: "./assets/amim/pink-mate.webp",
    white: "./assets/amim/white-mate.webp",
  },
  bodies: {
    cyan: "./assets/amim/cyan-dead.webp",
    red: "./assets/amim/red-dead.webp",
    yellow: "./assets/amim/yellow-dead.webp",
    lime: "./assets/amim/green-dead.webp",
    pink: "./assets/amim/pink-dead.webp",
    white: "./assets/amim/white-dead.webp",
  },
};

const WALLS_URL = "./walls.json";

const images = {
  map: null,
  crew: new Map(),
  bodies: new Map(),
};

const roomSpecs = [
  ["Upper Engine", 70, 235, 170, 145],
  ["Reactor", 250, 225, 170, 155],
  ["Security", 250, 405, 165, 110],
  ["MedBay", 440, 225, 170, 155],
  ["Cafeteria", 610, 110, 360, 240],
  ["Weapons", 1000, 205, 145, 140],
  ["O2", 1080, 355, 135, 110],
  ["Navigation", 1240, 250, 175, 165],
  ["Admin", 740, 425, 190, 125],
  ["Storage", 580, 545, 355, 215],
  ["Electrical", 350, 580, 170, 150],
  ["Lower Engine", 70, 590, 170, 150],
  ["Shields", 1010, 565, 180, 150],
];

const corridorSpecs = [
  ["Upper Engine", "Reactor", { x: 220, y: 285, w: 45, h: 48 }],
  ["Reactor", "MedBay", { x: 420, y: 279, w: 30, h: 56 }],
  ["MedBay", "Cafeteria", { x: 602, y: 246, w: 34, h: 56 }],
  ["Cafeteria", "Weapons", { x: 968, y: 240, w: 40, h: 48 }],
  ["Weapons", "Navigation", { x: 1132, y: 257, w: 116, h: 38 }],
  ["Weapons", "O2", { x: 1070, y: 340, w: 48, h: 28 }],
  ["Cafeteria", "Admin", { x: 809, y: 348, w: 58, h: 92 }],
  ["Admin", "Storage", { x: 804, y: 545, w: 58, h: 32 }],
  ["Storage", "Shields", { x: 935, y: 620, w: 78, h: 42 }],
  ["Storage", "Electrical", { x: 517, y: 625, w: 64, h: 42 }],
  ["Electrical", "Lower Engine", { x: 235, y: 635, w: 116, h: 42 }],
  ["Lower Engine", "Upper Engine", { x: 132, y: 378, w: 42, h: 214 }],
  ["Reactor", "Security", { x: 299, y: 377, w: 60, h: 36 }],
  ["Security", "Electrical", { x: 352, y: 505, w: 58, h: 84 }],
];

let wallSpecs = [];

const taskRooms = ["Weapons", "Navigation", "Admin", "Electrical", "Reactor", "Shields"];
const spriteKeys = ["cyan", "red", "yellow", "lime", "pink", "white"];

const rooms = roomSpecs.map(([name, x, y, w, h], index) => ({
  name,
  x,
  y,
  w,
  h,
  cx: x + w / 2,
  cy: y + h / 2,
  task: taskRooms.includes(name),
  color: index % 2 === 0 ? "#11283a" : "#0d2232",
}));

const roomByName = new Map(rooms.map((room) => [room.name, room]));
const corridors = corridorSpecs.map(([a, b, rect]) => ({ a, b, ...rect }));
const walkZones = [...rooms, ...corridors];
const graph = new Map();
for (const room of rooms) {
  graph.set(room.name, []);
}
for (const corridor of corridors) {
  graph.get(corridor.a).push(corridor.b);
  graph.get(corridor.b).push(corridor.a);
}

const keys = new Set();
const state = {
  player: null,
  bots: [],
  bodies: [],
  activeTaskIndex: 0,
  completedTasks: new Set(),
  progress: 0,
  feed: [],
  ended: false,
  message: "Quiet",
  lastTime: 0,
  showHitboxes: false,
};

function setHitboxesVisible(visible) {
  state.showHitboxes = visible;
  hitboxesToggle.checked = visible;
}

function setSettingsOpen(open) {
  settingsPanel.classList.toggle("hidden", !open);
  settingsButton.setAttribute("aria-expanded", String(open));
}

function pushFeed(text) {
  state.feed.unshift(text);
  state.feed = state.feed.slice(0, 8);
  feed.innerHTML = "";
  for (const entry of state.feed) {
    const div = document.createElement("div");
    div.className = "feed-entry";
    div.textContent = entry;
    feed.append(div);
  }
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function pointInRect(px, py, rect, padding = 0) {
  return (
    px >= rect.x - padding &&
    px <= rect.x + rect.w + padding &&
    py >= rect.y - padding &&
    py <= rect.y + rect.h + padding
  );
}

function pointInWalkZone(x, y, padding = 0) {
  return walkZones.some((zone) => pointInRect(x, y, zone, padding));
}

function distanceToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) {
    return Math.hypot(px - x1, py - y1);
  }

  const t = clamp(((px - x1) * dx + (py - y1) * dy) / lengthSq, 0, 1);
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function pointInWall(x, y, hitboxRadius = 0) {
  return wallSpecs.some((wall) =>
    wall.points.some((point, index) => {
      const nextPoint = wall.points[index + 1];
      return nextPoint && distanceToSegment(x, y, point[0], point[1], nextPoint[0], nextPoint[1]) <= wall.thickness / 2 + hitboxRadius;
    }),
  );
}

function getWallPenetration(x, y, hitboxRadius) {
  let penetration = 0;
  for (const wall of wallSpecs) {
    for (let index = 0; index < wall.points.length - 1; index += 1) {
      const point = wall.points[index];
      const nextPoint = wall.points[index + 1];
      const wallRadius = wall.thickness / 2 + hitboxRadius;
      const distanceToWall = distanceToSegment(x, y, point[0], point[1], nextPoint[0], nextPoint[1]);
      penetration = Math.max(penetration, wallRadius - distanceToWall);
    }
  }
  return penetration;
}

function getHitboxSamples(x, y, hitboxRadius) {
  const diagonal = hitboxRadius * 0.7;
  return [
    [x, y],
    [x + hitboxRadius, y],
    [x - hitboxRadius, y],
    [x, y + hitboxRadius],
    [x, y - hitboxRadius],
    [x + diagonal, y + diagonal],
    [x + diagonal, y - diagonal],
    [x - diagonal, y + diagonal],
    [x - diagonal, y - diagonal],
  ];
}

function isWalkable(x, y, entity) {
  const hitboxRadius = entity.hitboxRadius ?? entity.radius;
  if (x < hitboxRadius || x > WORLD.width - hitboxRadius || y < hitboxRadius || y > WORLD.height - hitboxRadius) {
    return false;
  }

  return (
    getHitboxSamples(x, y, hitboxRadius).every(([sampleX, sampleY]) => pointInWalkZone(sampleX, sampleY)) &&
    getWallPenetration(x, y, hitboxRadius) <= 0
  );
}

function canMoveEntityTo(entity, x, y) {
  const hitboxRadius = entity.hitboxRadius ?? entity.radius;
  if (x < hitboxRadius || x > WORLD.width - hitboxRadius || y < hitboxRadius || y > WORLD.height - hitboxRadius) {
    return false;
  }

  const insideWalkZone = getHitboxSamples(x, y, hitboxRadius).every(([sampleX, sampleY]) => pointInWalkZone(sampleX, sampleY));
  if (!insideWalkZone) {
    return false;
  }

  const currentPenetration = getWallPenetration(entity.x, entity.y, hitboxRadius);
  const nextPenetration = getWallPenetration(x, y, hitboxRadius);
  return nextPenetration <= 0 || nextPenetration < currentPenetration - 0.02;
}

function getRoomForPoint(x, y) {
  return rooms.find((room) => pointInRect(x, y, room)) || null;
}

function createCrewmate(name, color, startRoomName, isPlayer = false) {
  const room = roomByName.get(startRoomName);
  return {
    name,
    spriteKey: color,
    x: room.cx + randomBetween(-18, 18),
    y: room.cy + randomBetween(-18, 18),
    radius: PLAYER_RADIUS,
    hitboxRadius: PLAYER_HITBOX_RADIUS,
    speed: isPlayer ? 190 : 112 + randomBetween(-8, 18),
    alive: true,
    isPlayer,
    targetRoom: startRoomName,
    currentRoom: startRoomName,
    path: [],
    waypoint: null,
    corridorClearedFor: null,
    wait: 0,
    killCooldown: 0,
    alert: 0,
    role: "crew",
    walkPhase: 0,
    moving: false,
    stepDistance: 0,
    faceDir: -1,
  };
}

function shortestPath(from, to) {
  if (from === to) return [from];
  const queue = [[from]];
  const seen = new Set([from]);
  while (queue.length) {
    const path = queue.shift();
    const last = path[path.length - 1];
    for (const next of graph.get(last)) {
      if (seen.has(next)) continue;
      const newPath = [...path, next];
      if (next === to) return newPath;
      seen.add(next);
      queue.push(newPath);
    }
  }
  return [from];
}

function chooseDifferentRoom(current) {
  const options = rooms.filter((room) => room.name !== current);
  return options[Math.floor(Math.random() * options.length)].name;
}

function getConnectingCorridor(from, to) {
  return corridors.find((corridor) => (corridor.a === from && corridor.b === to) || (corridor.a === to && corridor.b === from));
}

function resetGame() {
  const player = createCrewmate("You", spriteKeys[0], "Cafeteria", true);
  const bots = [
    createCrewmate("Nova", spriteKeys[1], "MedBay"),
    createCrewmate("Byte", spriteKeys[2], "Admin"),
    createCrewmate("Pico", spriteKeys[3], "Storage"),
    createCrewmate("Echo", spriteKeys[4], "Navigation"),
    createCrewmate("Luma", spriteKeys[5], "Electrical"),
  ];
  bots[0].role = "impostor";
  bots[0].speed = 128;
  bots[0].killCooldown = 4;
  for (const bot of bots) {
    bot.targetRoom = chooseDifferentRoom(getRoomForPoint(bot.x, bot.y).name);
    bot.path = shortestPath(getRoomForPoint(bot.x, bot.y).name, bot.targetRoom).slice(1);
  }

  state.player = player;
  state.bots = bots;
  state.bodies = [];
  state.activeTaskIndex = 0;
  state.completedTasks = new Set();
  state.progress = 0;
  state.feed = [];
  state.ended = false;
  state.message = "Quiet";
  state.lastTime = 0;
  overlay.classList.add("hidden");
  feed.innerHTML = "";
  updateHud();
}

function updateHud() {
  tasksLabel.textContent = `${state.completedTasks.size} / ${TASK_COUNT}`;
  taskStrip.style.setProperty("--task-progress", `${(state.completedTasks.size / TASK_COUNT) * 100}%`);
  const livingCrew = [state.player, ...state.bots].filter((c) => c.alive && c.role === "crew").length;
  crewLabel.textContent = String(livingCrew);
  stateLabel.textContent = state.message;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function moveEntity(entity, dx, dy, dt) {
  const amount = entity.speed * dt;
  const startX = entity.x;
  const startY = entity.y;
  const steps = Math.max(1, Math.ceil(amount / MAX_COLLISION_STEP));
  const stepAmount = amount / steps;

  for (let i = 0; i < steps; i += 1) {
    const stepX = entity.x + dx * stepAmount;
    const stepY = entity.y + dy * stepAmount;

    if (canMoveEntityTo(entity, stepX, entity.y)) {
      entity.x = stepX;
    }
    if (canMoveEntityTo(entity, entity.x, stepY)) {
      entity.y = stepY;
    }
  }

  const movedX = entity.x - startX;
  const movedY = entity.y - startY;
  const moved = Math.hypot(movedX, movedY);
  if (moved > 0.01) {
    entity.moving = true;
    entity.stepDistance += moved;
    if (Math.abs(movedX) > 0.1) {
      entity.faceDir = movedX > 0 ? 1 : -1;
    }
  }
}

function normalize(dx, dy) {
  const mag = Math.hypot(dx, dy) || 1;
  return { x: dx / mag, y: dy / mag };
}

function updatePlayer(dt) {
  if (!state.player.alive) return;

  let dx = 0;
  let dy = 0;
  if (keys.has("w") || keys.has("arrowup")) dy -= 1;
  if (keys.has("s") || keys.has("arrowdown")) dy += 1;
  if (keys.has("a") || keys.has("arrowleft")) dx -= 1;
  if (keys.has("d") || keys.has("arrowright")) dx += 1;

  if (dx || dy) {
    const direction = normalize(dx, dy);
    moveEntity(state.player, direction.x, direction.y, dt);
  }
}

function updateBotPath(bot) {
  const roomAtBot = getRoomForPoint(bot.x, bot.y);
  if (roomAtBot) {
    bot.currentRoom = roomAtBot.name;
  }

  const currentRoom = bot.currentRoom || bot.targetRoom;
  if (!bot.path.length) {
    bot.targetRoom = chooseDifferentRoom(currentRoom);
    bot.path = shortestPath(currentRoom, bot.targetRoom).slice(1);
    bot.waypoint = null;
    bot.corridorClearedFor = null;
  }
}

function updateBot(bot, dt) {
  if (!bot.alive) return;
  if (bot.wait > 0) {
    bot.wait -= dt;
    return;
  }

  bot.killCooldown = Math.max(0, bot.killCooldown - dt);
  updateBotPath(bot);
  const nextRoomName = bot.path[0];
  if (!nextRoomName) return;
  const roomAtBot = getRoomForPoint(bot.x, bot.y);
  if (roomAtBot) {
    bot.currentRoom = roomAtBot.name;
  }
  const currentRoomName = bot.currentRoom || bot.targetRoom;
  const corridor = getConnectingCorridor(currentRoomName, nextRoomName);
  const room = roomByName.get(nextRoomName);
  if (!room) return;
  const inNextRoom = roomAtBot?.name === nextRoomName;

  if (bot.corridorClearedFor && bot.corridorClearedFor !== nextRoomName) {
    bot.corridorClearedFor = null;
  }

  if (!bot.waypoint && corridor && bot.corridorClearedFor !== nextRoomName && !inNextRoom) {
    bot.waypoint = { x: corridor.x + corridor.w / 2, y: corridor.y + corridor.h / 2, roomName: nextRoomName };
  }

  const target = bot.waypoint || room;
  const targetX = target.cx ?? target.x;
  const targetY = target.cy ?? target.y;
  const direction = normalize(targetX - bot.x, targetY - bot.y);
  moveEntity(bot, direction.x, direction.y, dt);

  if (bot.waypoint && Math.hypot(bot.waypoint.x - bot.x, bot.waypoint.y - bot.y) < 14) {
    bot.waypoint = null;
    bot.corridorClearedFor = nextRoomName;
  }

  const latestRoom = getRoomForPoint(bot.x, bot.y);
  if (latestRoom) {
    bot.currentRoom = latestRoom.name;
  }

  if (!bot.waypoint && latestRoom?.name === nextRoomName && Math.hypot(room.cx - bot.x, room.cy - bot.y) < 18) {
    bot.path.shift();
    bot.corridorClearedFor = null;
    if (!bot.path.length) {
      bot.wait = randomBetween(0.4, 1.6);
    }
  }

  if (bot.role === "impostor") {
    const possibleTargets = [state.player, ...state.bots].filter(
      (target) => target !== bot && target.alive && target.role === "crew",
    );
    const nearest = possibleTargets
      .map((target) => ({ target, dist: distance(bot, target) }))
      .sort((a, b) => a.dist - b.dist)[0];

    if (nearest && nearest.dist < 150) {
      const chase = normalize(nearest.target.x - bot.x, nearest.target.y - bot.y);
      moveEntity(bot, chase.x, chase.y, dt * 0.92);
      state.message = "Movement detected";
    }

    if (nearest && nearest.dist < 28 && bot.killCooldown === 0) {
      nearest.target.alive = false;
      bot.killCooldown = 5.5;
      const bodyRoom = getRoomForPoint(nearest.target.x, nearest.target.y)?.name || "Hallway";
      state.bodies.push({
        x: nearest.target.x,
        y: nearest.target.y,
        roomName: bodyRoom,
        reported: false,
        spriteKey: nearest.target.spriteKey,
      });
      pushFeed(`${nearest.target.name} was eliminated near ${bodyRoom}.`);
      state.message = "Alarm";
      if (nearest.target.isPlayer) {
        endGame(false, "You were caught by the impostor before finishing the repairs.");
      }
    }
  }
}

function getActiveTaskRoom() {
  return roomByName.get(taskRooms[state.activeTaskIndex]);
}

function updateTasks(dt) {
  if (state.ended || !state.player.alive) return;
  const activeRoom = getActiveTaskRoom();
  if (!activeRoom) return;
  const nearTask = Math.hypot(state.player.x - activeRoom.cx, state.player.y - activeRoom.cy) < 42;

  if (nearTask && keys.has("e")) {
    state.progress += dt;
    state.message = `Repairing ${activeRoom.name}`;
    if (state.progress >= 1.15) {
      state.completedTasks.add(activeRoom.name);
      pushFeed(`Task complete in ${activeRoom.name}.`);
      state.progress = 0;
      state.activeTaskIndex += 1;
      state.message = "Quiet";
      if (state.completedTasks.size >= TASK_COUNT) {
        endGame(true, "All tasks complete.");
      }
    }
  } else {
    state.progress = Math.max(0, state.progress - dt * 1.8);
  }
}

function tryReport() {
  if (state.ended || !state.player.alive) return;
  const nearby = state.bodies.find((body) => !body.reported && Math.hypot(body.x - state.player.x, body.y - state.player.y) < 34);
  if (!nearby) return;
  nearby.reported = true;
  pushFeed(`Body reported in ${nearby.roomName}. Ship logs exposed the impostor.`);
  endGame(true, "The impostor was ejected.");
}

function endGame(won, text) {
  if (state.ended) return;
  state.ended = true;
  overlay.classList.remove("hidden");
  overlayEyebrow.textContent = won ? "Crew Victory" : "Impostor Victory";
  overlayTitle.textContent = won ? "You Survived" : "Ship Lost";
  overlayText.textContent = text;
  state.message = won ? "Secured" : "Critical";
  updateHud();
}

function checkCrewCountLoss() {
  const livingCrew = [state.player, ...state.bots].filter((c) => c.alive && c.role === "crew").length;
  const livingImpostors = state.bots.filter((c) => c.alive && c.role === "impostor").length;
  if (livingCrew <= livingImpostors && livingImpostors > 0) {
    endGame(false, "The impostor wins.");
  }
}

function drawRoundedRect(x, y, w, h, radius, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function loadImage(url, timeout = 5000) {
  return new Promise((resolve) => {
    const image = new Image();
    const timer = window.setTimeout(() => resolve(null), timeout);
    image.decoding = "async";
    image.onload = () => {
      window.clearTimeout(timer);
      resolve(image);
    };
    image.onerror = () => {
      window.clearTimeout(timer);
      resolve(null);
    };
    image.src = url;
  });
}

function normalizeWallSpec(wall, index) {
  let points = Array.isArray(wall?.points)
    ? wall.points
        .map((point) => [Number(point?.[0]), Number(point?.[1])])
        .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y))
    : [];
  let x1 = Number(wall?.x1);
  let y1 = Number(wall?.y1);
  let x2 = Number(wall?.x2);
  let y2 = Number(wall?.y2);
  let thickness = Number(wall?.thickness);

  if (points.length < 2 && [x1, y1, x2, y2].every(Number.isFinite)) {
    points = [
      [x1, y1],
      [x2, y2],
    ];
  }

  if (points.length < 2) {
    const x = Number(wall?.x);
    const y = Number(wall?.y);
    const w = Number(wall?.w);
    const h = Number(wall?.h);
    if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) {
      return null;
    }

    if (w >= h) {
      points = [
        [x, y + h / 2],
        [x + w, y + h / 2],
      ];
      thickness = h;
    } else {
      points = [
        [x + w / 2, y],
        [x + w / 2, y + h],
      ];
      thickness = w;
    }
  }

  if (points.length < 2 || points.every(([x, y]) => x === points[0][0] && y === points[0][1])) {
    return null;
  }

  return {
    name: typeof wall.name === "string" && wall.name.trim() ? wall.name : `Wall ${index + 1}`,
    points,
    thickness: Number.isFinite(thickness) && thickness > 0 ? thickness : 4,
  };
}

async function loadWalls() {
  const response = await fetch(WALLS_URL, { cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`Unable to load ${WALLS_URL}: ${response.status}`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error(`${WALLS_URL} must contain an array of walls`);
  }

  wallSpecs = data.map(normalizeWallSpec).filter(Boolean);
}

async function loadAssets() {
  await loadWalls();

  loadImage(ASSET_URLS.map).then((image) => {
    images.map = image;
  });

  for (const [key, url] of Object.entries(ASSET_URLS.crew)) {
    loadImage(url).then((image) => {
      images.crew.set(key, image);
    });
  }

  for (const [key, url] of Object.entries(ASSET_URLS.bodies)) {
    loadImage(url).then((image) => {
      images.bodies.set(key, image);
    });
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function updateCamera() {
  if (!state.player) return;
  const worldViewWidth = view.width / camera.zoom;
  const worldViewHeight = view.height / camera.zoom;
  camera.x = clamp(state.player.x - worldViewWidth / 2, 0, Math.max(0, WORLD.width - worldViewWidth));
  camera.y = clamp(state.player.y - worldViewHeight / 2, 0, Math.max(0, WORLD.height - worldViewHeight));
}

function worldToScreen(x, y) {
  return {
    x: (x - camera.x) * camera.zoom,
    y: (y - camera.y) * camera.zoom,
  };
}

function drawCrewmate(entity) {
  const sprite = images.crew.get(entity.spriteKey);
  const screen = worldToScreen(entity.x, entity.y);
  const width = 42;
  const height = 52;
  const moving = entity.moving;
  const walk = entity.walkPhase;
  const bob = moving ? Math.sin(walk) * 3.6 : 0;
  const squashX = moving ? 1 + Math.abs(Math.cos(walk)) * 0.06 : 1;
  const squashY = moving ? 1 - Math.abs(Math.cos(walk)) * 0.05 : 1;
  const footSwing = moving ? Math.sin(walk) * 8 : 0;

  ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
  ctx.beginPath();
  ctx.ellipse(screen.x, screen.y + 17, 14, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(21, 31, 39, 0.9)";
  ctx.beginPath();
  ctx.ellipse(screen.x - 5, screen.y + 14, 5, 3, 0, 0, Math.PI * 2);
  ctx.ellipse(screen.x + 5, screen.y + 14, 5, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
  ctx.beginPath();
  ctx.ellipse(screen.x - 5, screen.y + 13 + footSwing * 0.24, 4, 2, 0, 0, Math.PI * 2);
  ctx.ellipse(screen.x + 5, screen.y + 13 - footSwing * 0.24, 4, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(screen.x, screen.y + bob);
  if (entity.faceDir > 0) {
    ctx.scale(-1, 1);
  }
  ctx.scale(squashX, squashY);

  if (sprite) {
    ctx.drawImage(sprite, -width / 2, -height / 2, width, height);
  } else {
    ctx.fillStyle = "#6ef2d1";
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.fillStyle = "#f3fbff";
  ctx.font = "700 11px Trebuchet MS";
  ctx.textAlign = "center";
  ctx.fillText(entity.name, screen.x, screen.y - 30 + bob);
}

function drawBody(body) {
  const sprite = images.bodies.get(body.spriteKey);
  const screen = worldToScreen(body.x, body.y);
  const width = 40;
  const height = 28;

  if (sprite) {
    ctx.drawImage(sprite, screen.x - width / 2, screen.y - height / 2, width, height);
    return;
  }

  ctx.fillStyle = "#8b1f1f";
  ctx.beginPath();
  ctx.ellipse(screen.x, screen.y, 24, 14, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawTaskMarker(room, activeRoom) {
  const screen = worldToScreen(room.cx, room.cy);
  const active = activeRoom?.name === room.name && !state.completedTasks.has(room.name);
  ctx.beginPath();
  ctx.fillStyle = active ? "#74ffcf" : "rgba(103, 222, 241, 0.45)";
  ctx.arc(screen.x, screen.y, active ? 9 : 6, 0, Math.PI * 2);
  ctx.fill();
  if (active) {
    ctx.strokeStyle = "rgba(116,255,207,0.6)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, 18 + Math.sin(performance.now() / 180) * 2, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawFog() {
  const cx = view.width / 2;
  const cy = view.height / 2;
  const gradient = ctx.createRadialGradient(cx, cy, 90, cx, cy, Math.max(view.width, view.height) * 0.52);
  gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
  gradient.addColorStop(0.62, "rgba(2, 8, 14, 0.12)");
  gradient.addColorStop(1, "rgba(2, 8, 14, 0.82)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, view.width, view.height);
}

function drawWorldFrame() {
  const topLeft = worldToScreen(0, 0);
  const bottomRight = worldToScreen(WORLD.width, WORLD.height);
  ctx.strokeStyle = "rgba(145, 214, 255, 0.18)";
  ctx.lineWidth = 2;
  ctx.strokeRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
}

function drawMap() {
  ctx.clearRect(0, 0, view.width, view.height);
  ctx.fillStyle = "#03070c";
  ctx.fillRect(0, 0, view.width, view.height);

  updateCamera();
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, view.width, view.height);
  ctx.clip();

  const mapX = -camera.x * camera.zoom;
  const mapY = -camera.y * camera.zoom;
  const mapWidth = WORLD.width * camera.zoom;
  const mapHeight = WORLD.height * camera.zoom;

  if (images.map) {
    ctx.drawImage(images.map, mapX, mapY, mapWidth, mapHeight);
  } else {
    ctx.fillStyle = "#081521";
    ctx.fillRect(0, 0, view.width, view.height);
    for (const corridor of corridors) {
      const screen = worldToScreen(corridor.x, corridor.y);
      drawRoundedRect(
        screen.x,
        screen.y,
        corridor.w * camera.zoom,
        corridor.h * camera.zoom,
        16,
        "#183040",
        "rgba(255,255,255,0.04)",
      );
    }
    for (const room of rooms) {
      const screen = worldToScreen(room.x, room.y);
      drawRoundedRect(
        screen.x,
        screen.y,
        room.w * camera.zoom,
        room.h * camera.zoom,
        28,
        room.color,
        "rgba(157,226,255,0.16)",
      );
    }
  }

  const activeRoom = getActiveTaskRoom();
  for (const room of rooms) {
    if (room.task) {
      drawTaskMarker(room, activeRoom);
    }
  }

  for (const body of state.bodies) {
    if (body.reported) continue;
    drawBody(body);
  }

  for (const entity of [state.player, ...state.bots]) {
    if (!entity.alive) continue;
    drawCrewmate(entity);
  }

  if (state.showHitboxes) {
    ctx.fillStyle = "rgba(255, 45, 45, 0.2)";
    ctx.strokeStyle = "rgba(255, 45, 45, 0.72)";
    ctx.lineCap = "round";
    for (const wall of wallSpecs) {
      ctx.lineWidth = wall.thickness * camera.zoom;
      ctx.beginPath();
      wall.points.forEach((point, index) => {
        const screen = worldToScreen(point[0], point[1]);
        if (index === 0) {
          ctx.moveTo(screen.x, screen.y);
        } else {
          ctx.lineTo(screen.x, screen.y);
        }
      });
      ctx.stroke();
    }
    ctx.lineCap = "butt";
    ctx.lineWidth = 2;

    if (state.player) {
      const samples = getHitboxSamples(state.player.x, state.player.y, state.player.hitboxRadius);
      ctx.fillStyle = "rgba(255, 255, 0, 0.8)";
      for (const [sx, sy] of samples) {
        const screen = worldToScreen(sx, sy);
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  drawWorldFrame();
  ctx.restore();

  drawFog();
  ctx.textAlign = "left";

  if (activeRoom && !state.ended) {
    ctx.fillStyle = "#dff8ff";
    ctx.font = "700 22px Trebuchet MS";
    ctx.fillText(`Next task: ${activeRoom.name}`, 44, 56);
  }

  const reportable = state.bodies.some(
    (body) => !body.reported && Math.hypot(body.x - state.player.x, body.y - state.player.y) < 34,
  );
  if (!state.ended && reportable) {
    ctx.fillStyle = "#ffd7d7";
    ctx.font = "22px Trebuchet MS";
    ctx.fillText("Press R to report body", 44, 88);
  }

  if (!state.ended && activeRoom && Math.hypot(state.player.x - activeRoom.cx, state.player.y - activeRoom.cy) < 42) {
    ctx.fillStyle = "#c1ffee";
    ctx.font = "22px Trebuchet MS";
    ctx.fillText("Hold E to repair", 44, 88);
  }

  if (state.progress > 0) {
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.fillRect(44, view.height - 56, 260, 16);
    ctx.fillStyle = "#6ef2d1";
    ctx.fillRect(44, view.height - 56, 260 * Math.min(1, state.progress / 1.15), 16);
  }
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  view.width = rect.width;
  view.height = rect.height;
  camera.zoom = Math.max(3.35, view.width / MAX_VISIBLE_WORLD.width, view.height / MAX_VISIBLE_WORLD.height);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
}

function tick(timestamp) {
  if (!state.lastTime) state.lastTime = timestamp;
  const dt = Math.min(0.033, (timestamp - state.lastTime) / 1000);
  state.lastTime = timestamp;

  for (const entity of [state.player, ...state.bots].filter(Boolean)) {
    entity.moving = false;
    entity.stepDistance = 0;
  }

  if (!state.ended) {
    updatePlayer(dt);
    for (const bot of state.bots) {
      updateBot(bot, dt);
    }
    updateTasks(dt);
    checkCrewCountLoss();
  }

  for (const entity of [state.player, ...state.bots].filter(Boolean)) {
    if (entity.moving) {
      entity.walkPhase += entity.stepDistance * 0.18;
    }
  }

  updateHud();
  drawMap();
  requestAnimationFrame(tick);
}

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  keys.add(key);
  if (key === "r") {
    tryReport();
  }
  if (key === "p") {
    setHitboxesVisible(!state.showHitboxes);
  }
  if (key === "escape") {
    setSettingsOpen(false);
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

window.addEventListener("resize", resizeCanvas);
restartButton.addEventListener("click", resetGame);
settingsButton.addEventListener("click", () => {
  setSettingsOpen(settingsPanel.classList.contains("hidden"));
});
hitboxesToggle.addEventListener("change", () => {
  setHitboxesVisible(hitboxesToggle.checked);
});

loadAssets().finally(() => {
  resizeCanvas();
  setHitboxesVisible(false);
  resetGame();
  requestAnimationFrame(tick);
});
