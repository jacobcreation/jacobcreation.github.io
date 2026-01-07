import { renderFiles, saveCurrentFile } from "./editor.js";
import { runSandbox } from "./sandbox.js";

function init() {
  console.log("Sandbox init");

  renderFiles();

  document.getElementById("run").addEventListener("click", () => {
    saveCurrentFile();
    runSandbox();
  });

  window.addEventListener("message", e => {
    const c = document.getElementById("console");
    c.textContent += e.data + "\n";
    c.scrollTop = c.scrollHeight;
  });

  runSandbox();
}

init();
