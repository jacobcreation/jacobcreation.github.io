const http = require("http");
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const port = Number.parseInt(process.env.PORT || "8061", 10);

const mimeTypes = {
  ".css": "text/css",
  ".html": "text/html; charset=utf-8",
  ".iso": "application/octet-stream",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".raw": "application/octet-stream",
  ".wasm": "application/wasm",
};

function sendError(res, code) {
  res.writeHead(code, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(http.STATUS_CODES[code] || "Error");
}

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const target = decoded === "/" ? "/index.html" : decoded;
  const fullPath = path.normalize(path.join(root, target));

  if (!fullPath.startsWith(root)) {
    return null;
  }

  return fullPath;
}

http
  .createServer((req, res) => {
    const filePath = safePath(req.url || "/");

    if (!filePath) {
      sendError(res, 403);
      return;
    }

    fs.stat(filePath, (statError, stats) => {
      if (statError || !stats.isFile()) {
        sendError(res, 404);
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const headers = {
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-cache",
        "Content-Type": mimeTypes[ext] || "application/octet-stream",
      };

      const range = req.headers.range;

      if (!range) {
        headers["Content-Length"] = stats.size;
        res.writeHead(200, headers);
        fs.createReadStream(filePath).pipe(res);
        return;
      }

      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match) {
        sendError(res, 416);
        return;
      }

      const start = match[1] === "" ? 0 : Number.parseInt(match[1], 10);
      const end = match[2] === "" ? stats.size - 1 : Number.parseInt(match[2], 10);

      if (Number.isNaN(start) || Number.isNaN(end) || start > end || end >= stats.size) {
        sendError(res, 416);
        return;
      }

      headers["Content-Length"] = end - start + 1;
      headers["Content-Range"] = `bytes ${start}-${end}/${stats.size}`;
      res.writeHead(206, headers);
      fs.createReadStream(filePath, { start, end }).pipe(res);
    });
  })
  .listen(port, "127.0.0.1", () => {
    console.log(`Range static server on http://127.0.0.1:${port}`);
  });
