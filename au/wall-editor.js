const WORLD = { width: 1560, height: 860 };
const MIN_THICKNESS = 1;
const SVG_NS = "http://www.w3.org/2000/svg";

const viewport = document.getElementById("viewport");
const world = document.getElementById("world");
const wallsLayer = document.getElementById("wallsLayer");
const wallList = document.getElementById("wallList");
const saveState = document.getElementById("saveState");
const addWallButton = document.getElementById("addWallButton");
const addPointButton = document.getElementById("addPointButton");
const duplicateWallButton = document.getElementById("duplicateWallButton");
const deleteWallButton = document.getElementById("deleteWallButton");
const saveButton = document.getElementById("saveButton");
const zoomOutButton = document.getElementById("zoomOutButton");
const zoomInButton = document.getElementById("zoomInButton");
const fitButton = document.getElementById("fitButton");
const zoomLabel = document.getElementById("zoomLabel");
const zoomSlider = document.getElementById("zoomSlider");

const inputs = {
  name: document.getElementById("wallNameInput"),
  x1: document.getElementById("wallX1Input"),
  y1: document.getElementById("wallY1Input"),
  x2: document.getElementById("wallX2Input"),
  y2: document.getElementById("wallY2Input"),
  thickness: document.getElementById("wallThicknessInput"),
};

let walls = [];
let selectedIndex = 0;
let zoom = 1;
let drag = null;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function setSaveState(text) {
  saveState.textContent = text;
}

function getSelectedWall() {
  return walls[selectedIndex] || null;
}

function rectToLine(wall, index) {
  const x = Number(wall?.x);
  const y = Number(wall?.y);
  const w = Number(wall?.w);
  const h = Number(wall?.h);
  if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) {
    return null;
  }

  if (w >= h) {
    return { name: wall.name || `Wall ${index + 1}`, x1: x, y1: y + h / 2, x2: x + w, y2: y + h / 2, thickness: h };
  }
  return { name: wall.name || `Wall ${index + 1}`, x1: x + w / 2, y1: y, x2: x + w / 2, y2: y + h, thickness: w };
}

function normalizeWall(wall, index) {
  const line = Array.isArray(wall?.points) ? wall : Number.isFinite(Number(wall?.x1)) ? wall : rectToLine(wall, index);
  if (!line) return null;
  const points = Array.isArray(line.points)
    ? line.points.map((point) => constrainPoint(Number(point?.[0]), Number(point?.[1]))).map((point) => [point.x, point.y])
    : [
        [Math.round(Number(line.x1) || 0), Math.round(Number(line.y1) || 0)],
        [Math.round(Number(line.x2) || 0), Math.round(Number(line.y2) || 0)],
      ];

  return {
    name: line.name || `Wall ${index + 1}`,
    points: points.length >= 2 ? points : [[720, 420], [780, 420]],
    thickness: Math.max(MIN_THICKNESS, Math.round(Number(line.thickness) || 4)),
  };
}

function constrainPoint(x, y) {
  return {
    x: clamp(Math.round(x), 0, WORLD.width),
    y: clamp(Math.round(y), 0, WORLD.height),
  };
}

function constrainWall(wall) {
  wall.points = wall.points.map(([x, y]) => {
    const point = constrainPoint(x, y);
    return [point.x, point.y];
  });
  wall.thickness = Math.max(MIN_THICKNESS, Math.round(wall.thickness));

  if (wall.points.length < 2) {
    wall.points = [[720, 420], [780, 420]];
  }

  if (wall.points.every(([x, y]) => x === wall.points[0][0] && y === wall.points[0][1])) {
    wall.points[wall.points.length - 1][0] = clamp(wall.points[0][0] + 24, 0, WORLD.width);
  }
}

function setZoom(nextZoom, anchor = null) {
  const previousZoom = zoom;
  const viewportRect = viewport.getBoundingClientRect();
  const anchorX = anchor ? anchor.clientX - viewportRect.left : viewport.clientWidth / 2;
  const anchorY = anchor ? anchor.clientY - viewportRect.top : viewport.clientHeight / 2;
  const worldX = (viewport.scrollLeft + anchorX) / previousZoom;
  const worldY = (viewport.scrollTop + anchorY) / previousZoom;

  zoom = clamp(nextZoom, 0.25, 6);
  world.style.width = `${WORLD.width * zoom}px`;
  world.style.height = `${WORLD.height * zoom}px`;
  zoomLabel.value = `${Math.round(zoom * 100)}%`;
  zoomSlider.value = Math.round(zoom * 100);
  renderWalls();

  viewport.scrollLeft = worldX * zoom - anchorX;
  viewport.scrollTop = worldY * zoom - anchorY;
}

function fitToViewport() {
  const availableWidth = Math.max(320, viewport.clientWidth - 128);
  const availableHeight = Math.max(260, viewport.clientHeight - 128);
  setZoom(Math.min(availableWidth / WORLD.width, availableHeight / WORLD.height));
  viewport.scrollTo({ left: 0, top: 0 });
}

function zoomAtViewportPoint(event) {
  event.preventDefault();
  const factor = event.deltaY > 0 ? 1 / 1.14 : 1.14;
  setZoom(zoom * factor, event);
}

function selectWall(index) {
  selectedIndex = clamp(index, 0, Math.max(0, walls.length - 1));
  syncInputs();
  render();
}

function syncInputs() {
  const wall = getSelectedWall();
  const disabled = !wall;
  for (const input of Object.values(inputs)) {
    input.disabled = disabled;
  }

  if (!wall) {
    for (const input of Object.values(inputs)) input.value = "";
    return;
  }

  inputs.name.value = wall.name;
  inputs.x1.value = wall.points[0][0];
  inputs.y1.value = wall.points[0][1];
  inputs.x2.value = wall.points[wall.points.length - 1][0];
  inputs.y2.value = wall.points[wall.points.length - 1][1];
  inputs.thickness.value = wall.thickness;
}

function renderList() {
  wallList.innerHTML = "";
  walls.forEach((wall, index) => {
    const button = document.createElement("button");
    button.className = `wall-row${index === selectedIndex ? " active" : ""}`;
    button.type = "button";
    button.innerHTML = `<strong></strong><span></span>`;
    button.querySelector("strong").textContent = wall.name;
    button.querySelector("span").textContent = `${wall.points.length} pts / ${wall.thickness}px`;
    button.addEventListener("click", () => selectWall(index));
    wallList.append(button);
  });
}

function createPointHandle(wall, wallIndex, pointIndex) {
  const point = wall.points[pointIndex];
  const handle = document.createElement("div");
  const positionClass = pointIndex === 0 ? "start" : pointIndex === wall.points.length - 1 ? "end" : "middle";
  handle.className = `point-handle ${positionClass}`;
  handle.style.left = `${point[0] * zoom}px`;
  handle.style.top = `${point[1] * zoom}px`;
  handle.addEventListener("pointerdown", (event) => beginDrag(event, wallIndex, pointIndex));
  handle.addEventListener("dblclick", (event) => {
    event.preventDefault();
    event.stopPropagation();
    removePoint(wallIndex, pointIndex);
  });
  return handle;
}

function getPathPoints(wall) {
  return wall.points.map(([x, y]) => `${x * zoom},${y * zoom}`).join(" ");
}

function renderWalls() {
  wallsLayer.innerHTML = "";
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.classList.add("walls-svg");
  svg.setAttribute("viewBox", `0 0 ${WORLD.width * zoom} ${WORLD.height * zoom}`);
  svg.setAttribute("preserveAspectRatio", "none");
  wallsLayer.append(svg);

  walls.forEach((wall, index) => {
    const polyline = document.createElementNS(SVG_NS, "polyline");
    polyline.classList.add("wall-line");
    if (index === selectedIndex) polyline.classList.add("active");
    polyline.setAttribute("points", getPathPoints(wall));
    polyline.setAttribute("stroke-width", Math.max(2, wall.thickness * zoom));
    polyline.addEventListener("pointerdown", (event) => beginDrag(event, index, "move"));
    polyline.addEventListener("dblclick", (event) => addPointAtEvent(event, index));
    svg.append(polyline);

    const label = document.createElement("div");
    label.className = "wall-label";
    label.textContent = wall.name;
    const middle = wall.points[Math.floor((wall.points.length - 1) / 2)];
    label.style.left = `${middle[0] * zoom}px`;
    label.style.top = `${middle[1] * zoom - 28}px`;
    wallsLayer.append(label);

    if (index === selectedIndex) {
      wall.points.forEach((_, pointIndex) => {
        wallsLayer.append(createPointHandle(wall, index, pointIndex));
      });
    }
  });
}

function render() {
  renderList();
  renderWalls();
}

function applyInputChange() {
  const wall = getSelectedWall();
  if (!wall) return;

  wall.name = inputs.name.value.trim() || `Wall ${selectedIndex + 1}`;
  wall.points[0] = [Number(inputs.x1.value), Number(inputs.y1.value)];
  wall.points[wall.points.length - 1] = [Number(inputs.x2.value), Number(inputs.y2.value)];
  wall.thickness = Number(inputs.thickness.value);
  constrainWall(wall);
  setSaveState("Unsaved");
  syncInputs();
  render();
}

function beginDrag(event, index, mode) {
  event.preventDefault();
  event.stopPropagation();
  selectWall(index);
  const wall = getSelectedWall();
  drag = {
    mode,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    wall: structuredClone(wall),
  };
  event.currentTarget.setPointerCapture(event.pointerId);
}

function moveLine(wall, dx, dy) {
  const xs = drag.wall.points.map(([x]) => x);
  const ys = drag.wall.points.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const safeDx = clamp(dx, -minX, WORLD.width - maxX);
  const safeDy = clamp(dy, -minY, WORLD.height - maxY);
  wall.points = drag.wall.points.map(([x, y]) => [x + safeDx, y + safeDy]);
}

function updateDrag(event) {
  if (!drag) return;
  const wall = getSelectedWall();
  if (!wall) return;

  const dx = (event.clientX - drag.startX) / zoom;
  const dy = (event.clientY - drag.startY) / zoom;
  if (drag.mode === "move") {
    moveLine(wall, dx, dy);
  } else {
    const point = constrainPoint(drag.wall.points[drag.mode][0] + dx, drag.wall.points[drag.mode][1] + dy);
    wall.points[drag.mode] = [point.x, point.y];
  }

  constrainWall(wall);
  setSaveState("Unsaved");
  syncInputs();
  render();
}

function endDrag() {
  drag = null;
}

function addWall() {
  const wall = normalizeWall({ name: `Wall ${walls.length + 1}`, points: [[720, 420], [780, 420]], thickness: 4 }, walls.length);
  walls.push(wall);
  selectWall(walls.length - 1);
  setSaveState("Unsaved");
}

function addPointAtSegment(wall, segmentIndex) {
  const start = wall.points[segmentIndex];
  const end = wall.points[segmentIndex + 1];
  wall.points.splice(segmentIndex + 1, 0, [Math.round((start[0] + end[0]) / 2), Math.round((start[1] + end[1]) / 2)]);
}

function getLongestSegmentIndex(wall) {
  let longestIndex = 0;
  let longestDistance = 0;
  for (let index = 0; index < wall.points.length - 1; index += 1) {
    const start = wall.points[index];
    const end = wall.points[index + 1];
    const distance = Math.hypot(end[0] - start[0], end[1] - start[1]);
    if (distance > longestDistance) {
      longestDistance = distance;
      longestIndex = index;
    }
  }
  return longestIndex;
}

function addBendPoint() {
  const wall = getSelectedWall();
  if (!wall) return;
  addPointAtSegment(wall, getLongestSegmentIndex(wall));
  setSaveState("Unsaved");
  syncInputs();
  render();
}

function addPointAtEvent(event, wallIndex) {
  event.preventDefault();
  event.stopPropagation();
  selectWall(wallIndex);
  const wall = getSelectedWall();
  if (!wall) return;
  const rect = world.getBoundingClientRect();
  const x = clamp(Math.round((event.clientX - rect.left) / zoom), 0, WORLD.width);
  const y = clamp(Math.round((event.clientY - rect.top) / zoom), 0, WORLD.height);
  const segmentIndex = getNearestSegmentIndex(wall, x, y);
  wall.points.splice(segmentIndex + 1, 0, [x, y]);
  setSaveState("Unsaved");
  syncInputs();
  render();
}

function getNearestSegmentIndex(wall, x, y) {
  let bestIndex = 0;
  let bestDistance = Infinity;
  for (let index = 0; index < wall.points.length - 1; index += 1) {
    const start = wall.points[index];
    const end = wall.points[index + 1];
    const distance = distanceToSegment(x, y, start[0], start[1], end[0], end[1]);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }
  return bestIndex;
}

function distanceToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(px - x1, py - y1);
  const t = clamp(((px - x1) * dx + (py - y1) * dy) / lengthSq, 0, 1);
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function removePoint(wallIndex, pointIndex) {
  const wall = walls[wallIndex];
  if (!wall || wall.points.length <= 2) return;
  wall.points.splice(pointIndex, 1);
  setSaveState("Unsaved");
  syncInputs();
  render();
}

function duplicateWall() {
  const wall = getSelectedWall();
  if (!wall) return;
  const copy = normalizeWall(
    { ...wall, name: `${wall.name} copy`, points: wall.points.map(([x, y]) => [x + 12, y + 12]) },
    walls.length,
  );
  constrainWall(copy);
  walls.splice(selectedIndex + 1, 0, copy);
  selectWall(selectedIndex + 1);
  setSaveState("Unsaved");
}

function deleteWall() {
  if (!getSelectedWall()) return;
  walls.splice(selectedIndex, 1);
  selectWall(Math.min(selectedIndex, walls.length - 1));
  setSaveState("Unsaved");
}

async function saveWalls() {
  setSaveState("Saving...");
  const response = await fetch("/api/walls", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(walls),
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || "Save failed");
  }
  setSaveState(`Saved ${result.count}`);
}

async function loadWalls() {
  const response = await fetch("./walls.json", { cache: "no-cache" });
  walls = (await response.json()).map(normalizeWall).filter(Boolean);
  walls.forEach(constrainWall);
  selectWall(0);
  setSaveState(`Loaded ${walls.length}`);
}

for (const input of Object.values(inputs)) {
  input.addEventListener("input", applyInputChange);
}

addWallButton.addEventListener("click", addWall);
addPointButton.addEventListener("click", addBendPoint);
duplicateWallButton.addEventListener("click", duplicateWall);
deleteWallButton.addEventListener("click", deleteWall);
saveButton.addEventListener("click", () => {
  saveWalls().catch((error) => setSaveState(error.message));
});
zoomOutButton.addEventListener("click", () => setZoom(zoom - 0.25));
zoomInButton.addEventListener("click", () => setZoom(zoom + 0.25));
zoomSlider.addEventListener("input", () => setZoom(Number(zoomSlider.value) / 100));
fitButton.addEventListener("click", fitToViewport);
viewport.addEventListener("wheel", zoomAtViewportPoint, { passive: false });
window.addEventListener("pointermove", updateDrag);
window.addEventListener("pointerup", endDrag);
window.addEventListener("resize", fitToViewport);

loadWalls()
  .then(fitToViewport)
  .catch((error) => setSaveState(error.message));
