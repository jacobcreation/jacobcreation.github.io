import { files } from "./editor.js";

export function runSandbox() {
  const frame = document.getElementById("frame");
  const consoleEl = document.getElementById("console");
  consoleEl.textContent = "";

  const userJS = (files.js || "").replace(/<\/script>/gi, "<\\/script>");

  frame.srcdoc = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <style>${files.css || ""}</style>
</head>
<body>
${files.html || ""}

<script>
(function () {
  function send(type, args) {
    parent.postMessage({ type, args }, "*");
  }

  console.log = (...a) => send("log", a);
  console.warn = (...a) => send("warn", a);
  console.error = (...a) => send("error", a);

  window.onerror = function (msg, src, line, col) {
    send("error", [msg + " (" + line + ":" + col + ")"]);
    return true;
  };

  window.onunhandledrejection = function (e) {
    send("error", [
      e.reason instanceof Error ? e.reason.message : String(e.reason)
    ]);
    return true;
  };

  try {
    const fn = new Function(\`
      "use strict";
      ${userJS}
    \`);
    fn();
  } catch (e) {
    send("error", [e.message]);
  }
})();
<\/script>

</body>
</html>
`;
}
