import { files } from "./editor.js";

export function runSandbox() {
  const frame = document.getElementById("frame");

  const html = files.html || "";
  const css = files.css || "";
  const js = files.js || "";

  frame.srcdoc = `
<!DOCTYPE html>
<html>
<head>
  <style>${css}</style>
</head>
<body>
  ${html}
  <script>
    const send = (msg) => parent.postMessage(msg, "*");
    console.log = (...a) => send(a.join(" "));
    try {
      ${js}
    } catch (e) {
      send("ERR: " + e.message);
    }
  <\/script>
</body>
</html>
`;
}
