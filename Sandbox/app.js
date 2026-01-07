import { initEditor, saveCurrentFile, files } from "./editor.js";
import { runSandbox } from "./sandbox.js";
import { askAI } from "./ai.js";

function init() {
  console.log("Sandbox init");

  initEditor();

  document.getElementById("run").addEventListener("click", () => {
    saveCurrentFile();
    runSandbox();
  });

  window.addEventListener("message", e => {
    const c = document.getElementById("console");
    c.textContent += e.data + "\n";
    c.scrollTop = c.scrollHeight;
  });

  const aiInput = document.getElementById("aiInput");
  aiInput.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      saveCurrentFile();
      askAI(aiInput.value, files);
      aiInput.value = "";
    }
  });

  runSandbox();
}

init();
