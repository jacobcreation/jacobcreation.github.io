import { initEditor, saveCurrentFile, files } from "./editor.js";
import { runSandbox } from "./sandbox.js";
import { askAI } from "./ai.js";

/* ================= CHAT RENDERING ================= */

function renderTextMessage(container, text, role) {
  const div = document.createElement("div");
  div.className = role === "user" ? "chat-user" : "chat-ai";
  div.textContent = text;
  container.appendChild(div);
}

function renderCodeBlock(container, codeText) {
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
  // normalize
  text = text.replace(/\r\n/g, "\n");

  // auto-close fences
  if ((text.match(/```/g) || []).length % 2 !== 0) {
    text += "\n```";
  }

  const parts = text.split("```");

  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      if (parts[i].trim()) {
        renderTextMessage(container, parts[i].trim(), "ai");
      }
    } else {
      let lines = parts[i].split("\n");
      if (/^(html|css|js|javascript)$/i.test(lines[0].trim())) {
        lines.shift();
      }
      renderCodeBlock(container, lines.join("\n"));
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

  /* RUN */
  document.getElementById("run").onclick = () => {
    saveCurrentFile();
    runSandbox();
  };

  /* CTRL + ENTER */
  document.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      saveCurrentFile();
      runSandbox();
    }
  });

  /* TAB HANDLING */
  const code = document.getElementById("code");
  code.addEventListener("keydown", e => {
    if (e.key === "Tab") {
      e.preventDefault();
      const s = code.selectionStart;
      code.value =
        code.value.slice(0, s) + "  " + code.value.slice(code.selectionEnd);
      code.selectionStart = code.selectionEnd = s + 2;
    }
  });

  /* CHAT INPUT */
  aiInput.addEventListener("keydown", async e => {
    if (e.key !== "Enter") return;

    const question = aiInput.value.trim();
    if (!question) return;

    aiInput.value = "";

    // render user ONCE
    renderTextMessage(aiLog, "🧑 " + question, "user");
    aiLog.scrollTop = aiLog.scrollHeight;

    // ask AI
    const reply = await askAI(question, files);

    renderAIResponse(aiLog, reply);
    aiLog.scrollTop = aiLog.scrollHeight;
  });

  /* CLEAR CHAT */
  document.getElementById("clearChat").onclick = () => {
    aiLog.innerHTML = "🤖 AI ready. Ask about your code.";
  };

  /* CONSOLE — iframe ONLY */
  window.addEventListener("message", e => {
    if (typeof e.data !== "string") return;
    consoleEl.textContent += e.data + "\n";
    consoleEl.scrollTop = consoleEl.scrollHeight;
  });
}

init();
