import { initEditor, saveCurrentFile, files } from "./editor.js";
import { runSandbox } from "./sandbox.js";
import { askAI } from "./ai.js";

/* ---------------- AI RENDERER ---------------- */

function renderAIMessage(container, text) {
  container.innerHTML = "";

  const parts = text.split("```");

  for (let i = 0; i < parts.length; i++) {
    // Normal text
    if (i % 2 === 0) {
      if (parts[i].trim()) {
        const div = document.createElement("div");
        div.textContent = parts[i];
        div.style.marginBottom = "8px";
        container.appendChild(div);
      }
    }
    // Code block
    else {
      let block = parts[i].trimStart();

      // Normalize:
      // supports ```html OR ```\nhtml
      const lines = block.split("\n");

      let lang = "";
      if (lines[0].match(/^(html|css|js)$/i)) {
        lang = lines.shift();
      }

      const code = lines.join("\n");

      const pre = document.createElement("pre");
      pre.style.position = "relative";

      const codeEl = document.createElement("code");
      codeEl.textContent = code;
      pre.appendChild(codeEl);

      const btn = document.createElement("button");
      btn.textContent = "Copy";
      btn.style.position = "absolute";
      btn.style.top = "6px";
      btn.style.right = "6px";
      btn.style.fontSize = "12px";

      btn.onclick = () => {
        navigator.clipboard.writeText(code);
        btn.textContent = "Copied!";
        setTimeout(() => (btn.textContent = "Copy"), 1000);
      };

      pre.appendChild(btn);
      container.appendChild(pre);
    }
  }

  container.scrollTop = container.scrollHeight;
}

/* ---------------- INIT ---------------- */

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
      code.value =
        code.value.slice(0, s) +
        "  " +
        code.value.slice(code.selectionEnd);
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
  const aiLog = document.getElementById("aiLog");

  aiInput.addEventListener("keydown", async e => {
    if (e.key === "Enter") {
      saveCurrentFile();

      const question = aiInput.value.trim();
      if (!question) return;

      const userMsg = document.createElement("div");
      userMsg.textContent = "🧑 " + question;
      userMsg.style.marginBottom = "6px";
      aiLog.appendChild(userMsg);

      aiInput.value = "";

      const reply = await askAI(question, files);

      const aiMsg = document.createElement("div");
      aiMsg.style.marginBottom = "12px";
      aiLog.appendChild(aiMsg);

      renderAIMessage(aiMsg, reply);
    }
  });

  // Clear chat
  document.getElementById("clearChat").onclick = () => {
    aiLog.textContent = "🤖 AI ready. Ask about your code.";
  };

  // Resizable divider
  const divider = document.getElementById("divider");
  let dragging = false;
  divider.onmousedown = () => (dragging = true);
  window.onmouseup = () => (dragging = false);
  window.onmousemove = e => {
    if (!dragging) return;
    const p = (e.clientX / window.innerWidth) * 100;
    document.getElementById("layout").style.gridTemplateColumns =
      `${p}% 6px ${100 - p}%`;
  };
}

init();
