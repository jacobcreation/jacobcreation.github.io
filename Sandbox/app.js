import { initEditor, saveCurrentFile, files } from "./editor.js";
import { runSandbox } from "./sandbox.js";
import { askAI } from "./ai.js";
import { downloadProjectZip } from "./zip.js";

function init() {
  initEditor();
  runSandbox();

  document.getElementById("run").onclick = () => {
    saveCurrentFile();
    runSandbox();
  };

  document.getElementById("downloadZip").onclick = downloadProjectZip;

  window.addEventListener("message", e => {
    const c = document.getElementById("console");
    const { type, args } = e.data || {};
    if (!type) return;

    const div = document.createElement("div");
    div.className = "console-" + type;
    div.textContent = args.join(" ");
    c.appendChild(div);
  });

  document.getElementById("clearConsole").onclick =
    () => (document.getElementById("console").textContent = "");

  const aiInput = document.getElementById("aiInput");
  const aiLog = document.getElementById("aiLog");

  aiInput.addEventListener("keydown", async e => {
    if (e.key !== "Enter") return;

    const q = aiInput.value.trim();
    if (!q) return;
    aiInput.value = "";

    aiLog.innerHTML += `<div class="chat-user">🧑 ${q}</div>`;
    const reply = await askAI(q, files);
    aiLog.innerHTML += `<div class="chat-ai">${reply}</div>`;
  });
}

window.addEventListener("DOMContentLoaded", init);
