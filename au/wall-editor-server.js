const http = require("http");
const fs = require("fs/promises");
const path = require("path");

const PORT = Number(process.env.PORT || 8787);
const HOST = "127.0.0.1";
const ROOT = __dirname;
const WALLS_FILE = path.join(ROOT, "walls.json");

const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".webp", "image/webp"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
]);

function send(response, status, body, type = "text/plain; charset=utf-8") {
  response.writeHead(status, {
    "content-type": type,
    "cache-control": "no-store",
  });
  response.end(body);
}

function normalizeWall(wall, index) {
  let thickness = Number(wall?.thickness);
  let points = Array.isArray(wall?.points)
    ? wall.points
        .map((point) => [Number(point?.[0]), Number(point?.[1])])
        .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y))
    : [];

  if (points.length < 2) {
    let x1 = Number(wall?.x1);
    let y1 = Number(wall?.y1);
    let x2 = Number(wall?.x2);
    let y2 = Number(wall?.y2);

    if ([x1, y1, x2, y2].every(Number.isFinite)) {
      points = [
        [x1, y1],
        [x2, y2],
      ];
    }
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
    name: typeof wall.name === "string" && wall.name.trim() ? wall.name.trim() : `Wall ${index + 1}`,
    points: points.map(([x, y]) => [Math.round(x), Math.round(y)]),
    thickness: Math.max(1, Math.round(Number.isFinite(thickness) ? thickness : 4)),
  };
}

async function readRequestBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function saveWalls(request, response) {
  try {
    const body = await readRequestBody(request);
    const data = JSON.parse(body);
    if (!Array.isArray(data)) {
      send(response, 400, JSON.stringify({ error: "Expected an array of wall objects" }), "application/json; charset=utf-8");
      return;
    }

    const walls = data.map(normalizeWall).filter(Boolean);
    await fs.writeFile(WALLS_FILE, `${JSON.stringify(walls, null, 2)}\n`);
    send(response, 200, JSON.stringify({ saved: true, count: walls.length }), "application/json; charset=utf-8");
  } catch (error) {
    send(response, 500, JSON.stringify({ error: error.message }), "application/json; charset=utf-8");
  }
}

async function serveFile(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (url.pathname === "/favicon.ico") {
    send(response, 204, "");
    return;
  }

  const requestedPath = url.pathname === "/" ? "/wall-editor.html" : decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(ROOT, requestedPath));

  if (!filePath.startsWith(ROOT)) {
    send(response, 403, "Forbidden");
    return;
  }

  try {
    const body = await fs.readFile(filePath);
    send(response, 200, body, contentTypes.get(path.extname(filePath)) || "application/octet-stream");
  } catch (error) {
    send(response, error.code === "ENOENT" ? 404 : 500, error.code === "ENOENT" ? "Not found" : error.message);
  }
}

const server = http.createServer((request, response) => {
  if (request.method === "POST" && request.url === "/api/walls") {
    saveWalls(request, response);
    return;
  }

  if (request.method === "GET" || request.method === "HEAD") {
    serveFile(request, response);
    return;
  }

  send(response, 405, "Method not allowed");
});

server.listen(PORT, HOST, () => {
  console.log(`Wall editor running at http://${HOST}:${PORT}/`);
});
