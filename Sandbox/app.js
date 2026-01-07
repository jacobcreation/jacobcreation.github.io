import { initEditor, saveCurrentFile, files } from "./editor.js";
import { runSandbox } from "./sandbox.js";
import { askAI } from "./ai.js";

function init() {
  console.log("Sandbox init");

  initEditor();
  runSandbox();

  // Run button
  document.getElementById("run").onclick = () => {
    saveCurrentFile();
    runSandbox();
  };

  // Ctrl / Cmd + Enter
  document.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      saveCurrentFile();
      runSandbox();
    }
  });

  // Tab inserts spaces
  const code = document.getElementById("code");
  code.addEventListener("keydown", e => {
    if (e.key === "Tab") {
      e.preventDefault();
      const s = code.selectionStart;
      code.value = code.value.slice(0,s) + "  " + code.value.slice(code.selectionEnd);
      code.selectionStart = code.selectionEnd = s + 2;
    }
  });

  // Console messages
  window.addEventListener("message", e => {
    const c = document.getElementById("console");
    c.textContent += e.data + "\n";
    c.scrollTop = c.scrollHeight;
  });

  // AI input
  const aiInput = document.getElementById("aiInput");
  aiInput.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      saveCurrentFile();
      askAI(aiInput.value, files);
      aiInput.value = "";
    }
  });

  // Clear chat
  document.getElementById("clearChat").onclick = () => {
    document.getElementById("aiLog").textContent =
      "🤖 AI ready. Ask about your code.";
  };

  // Resizable divider
  const divider = document.getElementById("divider");
  let dragging = false;
  divider.onmousedown = () => dragging = true;
  window.onmouseup = () => dragging = false;
  window.onmousemove = e => {
    if (!dragging) return;
    const p = e.clientX / window.innerWidth * 100;
    document.getElementById("layout").style.gridTemplateColumns =
      `${p}% 6px ${100-p}%`;
  };
}

init();
