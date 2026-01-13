import { initEditor, saveCurrentFile, files } from "./editor.js";
import { runSandbox } from "./sandbox.js";
import { askAI } from "./ai.js";

/* ================= RENDER HELPERS ================= */

function renderText(container, text, role = "ai") {
  const div = document.createElement("div");
  div.className = role === "user" ? "chat-user" : "chat-ai";
  div.textContent = text;
  container.appendChild(div);
}

function renderCode(container, codeText) {
  const wrap = document.createElement("div");
  wrap.className = "ai-code-wrap";

  const btn = document.createElement("button");
  btn.className = "ai-copy-btn";
  btn.textContent = "Copy";
  btn.onclick = () => {
    navigator.clipboard.writeText(codeText);
    btn.textContent = "Copied!";
    setTimeout(() => (btn.textContent = "Copy"), 1000);
  };

  const code = document.createElement("code");
  code.className = "ai-code";
  code.textContent = codeText;

  wrap.appendChild(btn);
  wrap.appendChild(code);
  container.appendChild(wrap);
}

function renderAIResponse(container, text) {
  if (typeof text !== "string") {
    renderText(container, "⚠️ AI returned no text.");
    return;
  }

  text = text.replace(/\r\n/g, "\n");

  if ((text.match(/```/g) || []).length % 2 !== 0) {
    text += "\n```";
  }

  const parts = text.split("```");

  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      if (parts[i].trim()) {
        renderText(container, parts[i].trim());
      }
    } else {
      let lines = parts[i].split("\n");
      if (/^(html|css|js|javascript)$/i.test(lines[0]?.trim())) {
        lines.shift();
      }
      renderCode(container, lines.join("\n"));
    }
  }
}

/* ================= INIT ================= */

function init() {
  initEditor();
  runSandbox();

  const aiLog = document.getElementById("aiLog");
  const aiInput = document.getElementById("aiInput");
  const consoleEl = document.getElementById("console");

  document.getElementById("run").onclick = () => {
    saveCurrentFile();
    runSandbox();
  };

  document.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      saveCurrentFile();
      runSandbox();
    }
  });

  const codeArea = document.getElementById("code");
  codeArea.addEventListener("keydown", e => {
    if (e.key === "Tab") {
      e.preventDefault();
      const s = codeArea.selectionStart;
      codeArea.value =
        codeArea.value.slice(0, s) + "  " + codeArea.value.slice(codeArea.selectionEnd);
      codeArea.selectionStart = codeArea.selectionEnd = s + 2;
    }
  });

  aiInput.addEventListener("keydown", async e => {
    if (e.key !== "Enter") return;

    const question = aiInput.value.trim();
    if (!question) return;

    aiInput.value = "";

    renderText(aiLog, "🧑 " + question, "user");

    aiLog.scrollTop = aiLog.scrollHeight;

    // IMPORTANT: askAI must return FULL STRING
    const reply = await askAI(question, files);

    renderAIResponse(aiLog, reply);
    aiLog.scrollTop = aiLog.scrollHeight;
  });

  document.getElementById("clearChat").onclick = () => {
    aiLog.innerHTML = "🤖 AI ready. Ask about your code.";
  };

  // Console ONLY listens to iframe
  window.addEventListener("message", e => {
    if (typeof e.data === "string") {
      consoleEl.textContent += e.data + "\n";
      consoleEl.scrollTop = consoleEl.scrollHeight;
    }
  });
}

init();
