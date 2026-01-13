import { files } from "./editor.js";

export function runSandbox() {
  const frame = document.getElementById("frame");
  const consoleEl = document.getElementById("console");

  // Clear sandbox console
  consoleEl.textContent = "";

  const userJS = (files.js || "")
    .replace(/<\/script>/gi, "<\\/script>");

  frame.srcdoc = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <style>
    ${files.css || ""}
  </style>
</head>
<body>

${files.html || ""}

<script>
(function () {

  /* ========= CONSOLE BRIDGE ========= */
  ["log", "warn", "error"].forEach(type => {
    console[type] = (...args) => {
      parent.postMessage({ type, args }, "*");
    };
  });

  /* ========= GLOBAL ERROR CAPTURE ========= */
  window.onerror = function (message, source, lineno, colno) {
    parent.postMessage(
      {
        type: "error",
        args: [message, source ? \`(\${lineno}:\${colno})\` : ""]
      },
      "*"
    );
    return true;
  };

  window.onunhandledrejection = function (event) {
    parent.postMessage(
      {
        type: "error",
        args: [
          event.reason instanceof Error
            ? event.reason.message
            : String(event.reason)
        ]
      },
      "*"
    );
    return true;
  };

  /* ========= USER CODE EXECUTION ========= */
  try {
    const run = new Function(\`
      "use strict";
      ${userJS}
    \`);
    run();
  } catch (e) {
    console.error(e);
  }

})();
<\/script>

</body>
</html>
`;
}
