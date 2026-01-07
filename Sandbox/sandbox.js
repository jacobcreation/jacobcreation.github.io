import { files } from "./editor.js";

export function runSandbox() {
  const frame = document.getElementById("frame");
  const consoleEl = document.getElementById("console");
  consoleEl.textContent = "";

  frame.srcdoc = `
<!DOCTYPE html>
<html>
<head>
<style>${files.css}</style>
</head>
<body>
${files.html}
<script>
  const send = (...a) => parent.postMessage(a.join(" "), "*");
  console.log = send;
  try {
    ${files.js}
  } catch (e) {
    send("ERR: " + e.message);
  }
<\/script>
</body>
</html>
`;
}
